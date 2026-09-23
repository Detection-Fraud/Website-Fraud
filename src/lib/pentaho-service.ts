import axios from "axios";
import { z } from "zod";

const EXECUTE_PATH = "carte/executeJob";
const STATUS_PATH = "carte/jobstatus";
const MAX_METADATA_STRING_LENGTH = 256;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_DEADLINE_MINUTES = 30;
const RUNNING_TOKENS = new Set(["running", "queued", "started", "accepted", "in_progress"]);
const SUCCEEDED_TOKENS = new Set(["success", "succeeded", "finished", "completed", "ok"]);
const FAILED_TOKENS = new Set([
  "failed",
  "failure",
  "error",
  "aborted",
  "stopped",
  "finished_with_errors",
]);
const EXECUTE_ACCEPTED_TOKENS = new Set(["accepted", "queued", "started", "running"]);

const pentahoResponseSchema = z
  .object({
    status: z.string().optional(),
    state: z.string().optional(),
    result: z.string().optional(),
    success: z.boolean().optional(),
    jobName: z.string().optional(),
    jobId: z.string().optional(),
    id: z.string().optional(),
    lastidrun: z.string().optional(),
    laststatus: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .strip();

type PentahoResponse = z.infer<typeof pentahoResponseSchema>;

export type PentahoJobState = "RUNNING" | "SUCCEEDED" | "FAILED";
export type PentahoResponseMetadata = Record<
  string,
  string | number | boolean | null
>;

export class PentahoServiceError extends Error {
  readonly code:
    | "CONFIGURATION"
    | "CONTRACT"
    | "HTTP"
    | "TIMEOUT"
    | "TRANSPORT";
  readonly ambiguous: boolean;
  readonly statusCode?: number;

  constructor(
    code: PentahoServiceError["code"],
    message: string,
    options: { ambiguous?: boolean; statusCode?: number } = {},
  ) {
    super(message);
    this.name = "PentahoServiceError";
    this.code = code;
    this.ambiguous = options.ambiguous ?? false;
    this.statusCode = options.statusCode;
  }
}

export type PentahoServiceConfig = {
  baseUrl: string;
  jobLocation: string;
  requestTimeoutMs: number;
  syncDeadlineMinutes: number;
};

function boundedPositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  maximum: number,
): number {
  const parsed = value === undefined || value.trim() === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new PentahoServiceError("CONFIGURATION", `${name} tidak valid`);
  }
  return parsed;
}

export function getPentahoServiceConfig(): PentahoServiceConfig {
  const rawBaseUrl = process.env.PENTAHO_SERVICE_BASE_URL?.trim();
  const jobLocation = process.env.PENTAHO_SYNC_JOB_LOCATION?.trim();

  if (!rawBaseUrl || !jobLocation) {
    throw new PentahoServiceError(
      "CONFIGURATION",
      "Konfigurasi layanan Pentaho belum lengkap",
    );
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new PentahoServiceError("CONFIGURATION", "URL layanan Pentaho tidak valid");
  }

  if (baseUrl.username || baseUrl.password || !["http:", "https:"].includes(baseUrl.protocol)) {
    throw new PentahoServiceError("CONFIGURATION", "URL layanan Pentaho tidak diizinkan");
  }

  if (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
    throw new PentahoServiceError(
      "CONFIGURATION",
      "Produksi mewajibkan HTTPS untuk layanan Pentaho",
    );
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(jobLocation) || jobLocation.includes("?")) {
    throw new PentahoServiceError("CONFIGURATION", "Lokasi job Pentaho harus berupa path konfigurasi");
  }

  return {
    baseUrl: baseUrl.toString().replace(/\/$/, ""),
    jobLocation,
    requestTimeoutMs: boundedPositiveInteger(
      process.env.PENTAHO_REQUEST_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      "PENTAHO_REQUEST_TIMEOUT_MS",
      120_000,
    ),
    syncDeadlineMinutes: boundedPositiveInteger(
      process.env.PENTAHO_SYNC_DEADLINE_MINUTES,
      DEFAULT_DEADLINE_MINUTES,
      "PENTAHO_SYNC_DEADLINE_MINUTES",
      1_440,
    ),
  };
}

function endpoint(config: PentahoServiceConfig, suffix: string): string {
  return `${config.baseUrl}/${suffix}`;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[()]/g, "").replace(/[\s-]+/g, "_");
}

function responseMetadata(body: PentahoResponse): PentahoResponseMetadata {
  const allowed = [
    "status",
    "state",
    "result",
    "success",
    "jobName",
    "jobId",
    "id",
    "lastidrun",
    "laststatus",
    "message",
  ] as const;
  const metadata: PentahoResponseMetadata = {};
  for (const key of allowed) {
    const value = body[key];
    if (value === undefined) continue;
    metadata[key] = typeof value === "string" ? value.slice(0, MAX_METADATA_STRING_LENGTH) : value;
  }
  return metadata;
}

function parseResponseBody(body: unknown): PentahoResponse {
  const parsed = pentahoResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new PentahoServiceError("CONTRACT", "Respons layanan Pentaho tidak valid");
  }
  return parsed.data;
}

function stateFromResponse(body: PentahoResponse): PentahoJobState {
  if (body.laststatus !== undefined) {
    if (body.status !== "200") {
      throw new PentahoServiceError("CONTRACT", "Status job Pentaho tidak tersedia");
    }
    const value = normalizeToken(body.laststatus);
    if (RUNNING_TOKENS.has(value)) return "RUNNING";
    if (SUCCEEDED_TOKENS.has(value)) return "SUCCEEDED";
    if (FAILED_TOKENS.has(value)) return "FAILED";
    throw new PentahoServiceError("CONTRACT", "Status layanan Pentaho tidak dikenali");
  }

  const values = [body.status, body.state, body.result]
    .filter((value): value is string => value !== undefined)
    .map(normalizeToken)
    .filter((value) => value.length > 0);
  const mapped = new Set<PentahoJobState>();
  for (const value of values) {
    if (RUNNING_TOKENS.has(value)) mapped.add("RUNNING");
    else if (SUCCEEDED_TOKENS.has(value)) mapped.add("SUCCEEDED");
    else if (FAILED_TOKENS.has(value)) mapped.add("FAILED");
    else throw new PentahoServiceError("CONTRACT", "Status layanan Pentaho tidak dikenali atau kontradiktif");
  }
  if (mapped.size !== 1) {
    throw new PentahoServiceError("CONTRACT", "Status layanan Pentaho tidak dikenali atau kontradiktif");
  }
  const state = [...mapped][0];
  if ((body.success === true && state === "FAILED") || (body.success === false && state !== "FAILED")) {
    throw new PentahoServiceError("CONTRACT", "Status layanan Pentaho tidak dikenali atau kontradiktif");
  }
  return state;
}

function executeAccepted(body: PentahoResponse): boolean {
  if (body.laststatus !== undefined || body.lastidrun !== undefined) {
    if (
      body.status !== "200" ||
      !body.lastidrun?.trim() ||
      !body.laststatus ||
      !RUNNING_TOKENS.has(normalizeToken(body.laststatus))
    ) {
      throw new PentahoServiceError("CONTRACT", "Respons eksekusi Pentaho tidak diterima");
    }
    return true;
  }

  const tokens = [body.status, body.state, body.result]
    .filter((value): value is string => value !== undefined)
    .map(normalizeToken);
  const accepted = tokens.filter((value) => EXECUTE_ACCEPTED_TOKENS.has(value));
  const rejected = tokens.filter((value) => FAILED_TOKENS.has(value) || value === "rejected");
  const unknown = tokens.filter(
    (value) => !EXECUTE_ACCEPTED_TOKENS.has(value) && !FAILED_TOKENS.has(value),
  );
  if (body.success === false || rejected.length > 0 || unknown.length > 0 || accepted.length === 0) {
    throw new PentahoServiceError("CONTRACT", "Respons eksekusi Pentaho tidak diterima");
  }
  return true;
}

function serviceError(error: unknown, operation: string): PentahoServiceError {
  if (error instanceof PentahoServiceError) return error;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status !== undefined) {
      return new PentahoServiceError("HTTP", `Layanan Pentaho menolak ${operation}`, { statusCode: status });
    }
    const timeout = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
    return new PentahoServiceError(
      timeout ? "TIMEOUT" : "TRANSPORT",
      timeout ? `Batas waktu layanan Pentaho tercapai saat ${operation}` : `Transport layanan Pentaho ambigu saat ${operation}`,
      { ambiguous: true },
    );
  }
  return new PentahoServiceError("TRANSPORT", `Transport layanan Pentaho gagal saat ${operation}`, { ambiguous: true });
}

async function post(path: string, body: Record<string, string>, operation: string) {
  const config = getPentahoServiceConfig();
  try {
    const response = await axios.post(endpoint(config, path), body, {
      timeout: config.requestTimeoutMs,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: { "Content-Type": "application/json" },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new PentahoServiceError("HTTP", `Layanan Pentaho menolak ${operation}`, { statusCode: response.status });
    }
    return parseResponseBody(response.data);
  } catch (error) {
    throw serviceError(error, operation);
  }
}

export async function executePentahoEmployeeJob(input: { jobName: string }) {
  if (!input.jobName.trim()) throw new PentahoServiceError("CONTRACT", "Nama job Pentaho wajib diisi");
  const config = getPentahoServiceConfig();
  const body = await post(
    EXECUTE_PATH,
    { jobName: input.jobName, jobLocation: config.jobLocation, param: "" },
    "eksekusi",
  );
  executeAccepted(body);
  return { accepted: true as const, responseMetadata: responseMetadata(body) };
}

export async function getPentahoEmployeeJobStatus(input: { jobName: string }) {
  if (!input.jobName.trim()) throw new PentahoServiceError("CONTRACT", "Nama job Pentaho wajib diisi");
  const body = await post(STATUS_PATH, { jobName: input.jobName }, "status");
  return { state: stateFromResponse(body), responseMetadata: responseMetadata(body) };
}

export { pentahoResponseSchema };
