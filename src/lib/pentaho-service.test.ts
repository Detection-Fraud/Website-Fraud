import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import {
  executePentahoEmployeeJob,
  getPentahoEmployeeJobStatus,
  getPentahoServiceConfig,
  PentahoServiceError,
} from "@/lib/pentaho-service";

const envKeys = [
  "PENTAHO_SERVICE_BASE_URL",
  "PENTAHO_SYNC_JOB_LOCATION",
  "PENTAHO_REQUEST_TIMEOUT_MS",
  "PENTAHO_SYNC_DEADLINE_MINUTES",
  "PENTAHO_ALLOW_HTTP_UAT",
] as const;

function configure() {
  process.env.PENTAHO_SERVICE_BASE_URL = "http://pentaho-uat.test:8080/";
  process.env.PENTAHO_SYNC_JOB_LOCATION = "/jobs/sync_budaya.kjb";
  process.env.PENTAHO_REQUEST_TIMEOUT_MS = "1200";
  process.env.PENTAHO_SYNC_DEADLINE_MINUTES = "5";
}

function setNodeEnv(value: string | undefined) {
  const mutableEnv = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete mutableEnv.NODE_ENV;
  } else {
    mutableEnv.NODE_ENV = value;
  }
}

test.afterEach(() => {
  for (const key of envKeys) delete process.env[key];
});

test("uses fixed endpoints and exact request shapes", async () => {
  configure();
  const calls: unknown[] = [];
  const original = axios.post;
  axios.post = (async (url: string, body: unknown, config: unknown) => {
    calls.push({ url, body, config });
    return {
      status: 200,
      data: { status: "200", lastidrun: "carte-run-1", laststatus: "Running" },
    };
  }) as typeof axios.post;
  try {
    await executePentahoEmployeeJob({ jobName: "job-1" });
    axios.post = (async (url: string, body: unknown, config: unknown) => {
      calls.push({ url, body, config });
      return { status: 200, data: { status: "200", laststatus: "Running" } };
    }) as typeof axios.post;
    await getPentahoEmployeeJobStatus({ jobName: "job-1" });
  } finally {
    axios.post = original;
  }
  assert.deepEqual(calls.map((call) => (call as { url: string }).url), [
    "http://pentaho-uat.test:8080/carte/executeJob",
    "http://pentaho-uat.test:8080/carte/jobstatus",
  ]);
  assert.deepEqual((calls[0] as { body: unknown }).body, {
    jobName: "job-1",
    jobLocation: "/jobs/sync_budaya.kjb",
    param: "",
  });
  assert.deepEqual((calls[1] as { body: unknown }).body, { jobName: "job-1" });
  assert.equal((calls[0] as { config: { maxRedirects: number } }).config.maxRedirects, 0);
  assert.equal((calls[0] as { config: { proxy: boolean } }).config.proxy, false);
});

test("validates configuration, timeout, and production HTTPS gate", () => {
  configure();
  assert.deepEqual(getPentahoServiceConfig(), {
    baseUrl: "http://pentaho-uat.test:8080",
    jobLocation: "/jobs/sync_budaya.kjb",
    requestTimeoutMs: 1200,
    syncDeadlineMinutes: 5,
  });
  const oldNodeEnv = process.env.NODE_ENV;
  setNodeEnv("production");
  assert.throws(() => getPentahoServiceConfig(), PentahoServiceError);
  setNodeEnv(oldNodeEnv);
});

test("production permits HTTP only with an explicit UAT flag and private IPv4 target", () => {
  configure();
  const oldNodeEnv = process.env.NODE_ENV;
  setNodeEnv("production");
  process.env.PENTAHO_SERVICE_BASE_URL = "http://10.254.223.21:8080/pentaho-bulog-service/";

  try {
    assert.throws(() => getPentahoServiceConfig(), PentahoServiceError);
    process.env.PENTAHO_ALLOW_HTTP_UAT = "TRUE";
    assert.throws(() => getPentahoServiceConfig(), PentahoServiceError);
    process.env.PENTAHO_ALLOW_HTTP_UAT = "true";
    assert.equal(
      getPentahoServiceConfig().baseUrl,
      "http://10.254.223.21:8080/pentaho-bulog-service",
    );

    for (const host of ["8.8.8.8", "169.254.10.1", "pentaho-uat.test"]) {
      process.env.PENTAHO_SERVICE_BASE_URL = `http://${host}:8080/pentaho-bulog-service/`;
      assert.throws(() => getPentahoServiceConfig(), PentahoServiceError);
    }

    delete process.env.PENTAHO_ALLOW_HTTP_UAT;
    process.env.PENTAHO_SERVICE_BASE_URL = "https://pentaho.example.test/";
    assert.equal(getPentahoServiceConfig().baseUrl, "https://pentaho.example.test");
  } finally {
    setNodeEnv(oldNodeEnv);
  }
});

test("maps terminal states and returns only scalar whitelisted metadata", async () => {
  configure();
  const original = axios.post;
  axios.post = (async () => ({
    status: 200,
    data: { state: "Succeeded", jobName: "job-1", message: "done" },
  })) as typeof axios.post;
  try {
    const result = await getPentahoEmployeeJobStatus({ jobName: "job-1" });
    assert.equal(result.state, "SUCCEEDED");
    assert.deepEqual(result.responseMetadata, {
      state: "Succeeded",
      jobName: "job-1",
      message: "done",
    });
  } finally {
    axios.post = original;
  }
});

test("maps the deployed facade job status contract", async () => {
  configure();
  const original = axios.post;
  axios.post = (async () => ({
    status: 200,
    data: {
      status: "200",
      lastidrun: "carte-run-1",
      laststatus: "Finished",
      dateexecute: "2026-09-22 12:00:00",
    },
  })) as typeof axios.post;
  try {
    const result = await getPentahoEmployeeJobStatus({ jobName: "job-1" });
    assert.equal(result.state, "SUCCEEDED");
    assert.deepEqual(result.responseMetadata, {
      status: "200",
      lastidrun: "carte-run-1",
      laststatus: "Finished",
    });
  } finally {
    axios.post = original;
  }
});

test("maps facade terminal error states and rejects no-content status", async () => {
  configure();
  const original = axios.post;
  try {
    axios.post = (async () => ({
      status: 200,
      data: { status: "200", laststatus: "Finished (with errors)" },
    })) as typeof axios.post;
    assert.equal(
      (await getPentahoEmployeeJobStatus({ jobName: "job-1" })).state,
      "FAILED",
    );

    axios.post = (async () => ({
      status: 200,
      data: { status: "204", error: "no_content", message: "Data Tidak ditemukan" },
    })) as typeof axios.post;
    await assert.rejects(
      getPentahoEmployeeJobStatus({ jobName: "job-1" }),
      (error: unknown) => error instanceof PentahoServiceError && error.code === "CONTRACT",
    );
  } finally {
    axios.post = original;
  }
});

test("maps a valid failed terminal response without exposing raw fields", async () => {
  configure();
  const original = axios.post;
  axios.post = (async () => ({
    status: 200,
    data: { state: "Failed", result: "Error", jobName: "job-1", error: "internal detail" },
  })) as typeof axios.post;
  try {
    const result = await getPentahoEmployeeJobStatus({ jobName: "job-1" });
    assert.equal(result.state, "FAILED");
    assert.deepEqual(result.responseMetadata, {
      state: "Failed",
      result: "Error",
      jobName: "job-1",
    });
  } finally {
    axios.post = original;
  }
});

test("requires an explicit accepted execute token", async () => {
  configure();
  const original = axios.post;
  axios.post = (async () => ({ status: 200, data: { success: true } })) as typeof axios.post;
  try {
    await assert.rejects(
      executePentahoEmployeeJob({ jobName: "job-1" }),
      (error: unknown) => error instanceof PentahoServiceError && error.code === "CONTRACT",
    );
  } finally {
    axios.post = original;
  }
});

test("rejects malformed, unknown, contradictory, and non-2xx responses", async () => {
  configure();
  const original = axios.post;
  const responses = [
    { status: 200, data: { state: "mystery" } },
    { status: 200, data: { state: "Running", result: "Failed" } },
    { status: 200, data: { state: "Running", result: "mystery" } },
    { status: 200, data: "not-json" },
    { status: 502, data: { state: "Failed" } },
  ];
  try {
    for (const response of responses) {
      axios.post = (async () => response) as typeof axios.post;
      await assert.rejects(
        getPentahoEmployeeJobStatus({ jobName: "job-1" }),
        PentahoServiceError,
      );
    }
  } finally {
    axios.post = original;
  }
});

test("does not retry an ambiguous transport failure", async () => {
  configure();
  const original = axios.post;
  let calls = 0;
  axios.post = (async () => {
    calls += 1;
    const error = new axios.AxiosError("socket reset", "ECONNRESET");
    throw error;
  }) as typeof axios.post;
  try {
    await assert.rejects(
      executePentahoEmployeeJob({ jobName: "job-1" }),
      (error: unknown) => error instanceof PentahoServiceError && error.ambiguous,
    );
    assert.equal(calls, 1);
  } finally {
    axios.post = original;
  }
});

test("classifies timeout as a sanitized ambiguous transport error", async () => {
  configure();
  const original = axios.post;
  axios.post = (async () => {
    throw new axios.AxiosError("timeout after request", "ETIMEDOUT");
  }) as typeof axios.post;
  try {
    await assert.rejects(
      getPentahoEmployeeJobStatus({ jobName: "job-1" }),
      (error: unknown) =>
        error instanceof PentahoServiceError &&
        error.code === "TIMEOUT" &&
        error.ambiguous === true &&
        !error.message.includes("timeout after request"),
    );
  } finally {
    axios.post = original;
  }
});
