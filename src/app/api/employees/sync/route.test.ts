import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import type {
  getLatestEmployeePentahoSync,
  startEmployeePentahoSync,
} from "@/lib/employee-sync-orchestrator";
import type {
  EmployeeSyncStartResult,
  EmployeeSyncStatus,
} from "@/types/employee-sync.types";

const requireAdminMock = mock.fn(async () => ({
  user: { id: "admin-1", name: "Admin", role: "ADMIN" },
}));
const startMock = mock.fn<typeof startEmployeePentahoSync>(async () => ({
  runId: "00000000-0000-4000-8000-000000000001",
  sourceSystem: "PENTAHO",
  status: "RUNNING" as const,
  phase: "PENTAHO_RUNNING" as const,
  startedAt: "2026-09-22T00:00:00.000Z",
  completedAt: null,
  deadlineAt: "2026-09-22T00:30:00.000Z",
  receivedCount: 0,
  processedCount: 0,
  missingCount: 0,
  deactivatedCount: 0,
  errorMessage: null,
  canStart: false,
  disposition: "STARTED" as const,
  externalJobName: "must-not-leak",
  sourceMetadata: { secret: "must-not-leak" },
} as EmployeeSyncStartResult));
const latestMock = mock.fn<typeof getLatestEmployeePentahoSync>(async () => null);

mock.module("@/lib/api/auth-guard", {
  namedExports: { requireAdmin: requireAdminMock, ApiError: class ApiError extends Error {} },
});
mock.module("@/lib/employee-sync-orchestrator", {
  namedExports: {
    startEmployeePentahoSync: startMock,
    getLatestEmployeePentahoSync: latestMock,
  },
});

let GET: () => Promise<Response>;
let POST: () => Promise<Response>;

before(async () => {
  ({ GET, POST } = await import("./route"));
});

describe("POST /api/employees/sync", () => {
  it("requires Admin before starting a sync", async () => {
    requireAdminMock.mock.mockImplementationOnce(async () => {
      throw new Error("unauthorized");
    });
    startMock.mock.resetCalls();

    const response = await POST();

    assert.equal(response.status, 500);
    assert.equal(startMock.mock.callCount(), 0);
  });

  it("returns 202 for a newly started run and strips internal fields", async () => {
    requireAdminMock.mock.mockImplementation(async () => ({
      user: { id: "admin-1", name: "Admin", role: "ADMIN" },
    }));
    startMock.mock.resetCalls();
    const result = {
      runId: "00000000-0000-4000-8000-000000000001",
      sourceSystem: "PENTAHO",
      status: "RUNNING" as const,
      phase: "PENTAHO_RUNNING" as const,
      startedAt: "2026-09-22T00:00:00.000Z",
      completedAt: null,
      deadlineAt: "2026-09-22T00:30:00.000Z",
      receivedCount: 0,
      processedCount: 0,
      missingCount: 0,
      deactivatedCount: 0,
      errorMessage: null,
      canStart: false,
      disposition: "STARTED" as const,
      externalJobName: "must-not-leak",
    };
    startMock.mock.mockImplementationOnce(async () => result as EmployeeSyncStartResult);

    const response = await POST();
    const body = await response.json();
    assert.equal(response.status, 202);
    assert.equal(body.status, 202);
    assert.equal(body.data.externalJobName, undefined);
    assert.equal(body.data.disposition, undefined);
  });

  it("returns 200 when an active run is reused", async () => {
    startMock.mock.mockImplementationOnce(async () => ({
      runId: "00000000-0000-4000-8000-000000000001",
      sourceSystem: "PENTAHO",
      status: "RUNNING" as const,
      phase: "PENTAHO_RUNNING" as const,
      startedAt: "2026-09-22T00:00:00.000Z",
      completedAt: null,
      deadlineAt: null,
      receivedCount: 0,
      processedCount: 0,
      missingCount: 0,
      deactivatedCount: 0,
      errorMessage: null,
      canStart: false,
      disposition: "REUSED" as const,
    } as EmployeeSyncStartResult));
    const response = await POST();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 200);
  });

  it("maps a definite Pentaho execute rejection to sanitized 502", async () => {
    startMock.mock.mockImplementationOnce(async () => ({
      runId: "00000000-0000-4000-8000-000000000001",
      sourceSystem: "PENTAHO",
      status: "FAILED" as const,
      phase: "TRIGGERING" as const,
      startedAt: "2026-09-22T00:00:00.000Z",
      completedAt: "2026-09-22T00:01:00.000Z",
      deadlineAt: "2026-09-22T00:30:00.000Z",
      receivedCount: 0,
      processedCount: 0,
      missingCount: 0,
      deactivatedCount: 0,
      errorMessage: "PENTAHO_EXECUTE_REJECTED",
      canStart: true,
      disposition: "STARTED" as const,
    } as EmployeeSyncStartResult));

    const response = await POST();
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.status, 502);
    assert.equal(body.data, null);
    assert.equal(body.message.includes("PENTAHO_EXECUTE_REJECTED"), false);
  });
});

describe("GET /api/employees/sync", () => {
  it("returns null when no sync run exists", async () => {
    latestMock.mock.mockImplementationOnce(async () => null);
    const response = await GET();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 200);
    assert.equal(body.data, null);
  });

  it("returns a safe latest status", async () => {
    latestMock.mock.mockImplementationOnce(async () => ({
      runId: "00000000-0000-4000-8000-000000000001",
      sourceSystem: "PENTAHO",
      status: "RUNNING" as const,
      phase: "PENTAHO_RUNNING" as const,
      startedAt: "2026-09-22T00:00:00.000Z",
      completedAt: null,
      deadlineAt: null,
      receivedCount: 0,
      processedCount: 0,
      missingCount: 0,
      deactivatedCount: 0,
      errorMessage: null,
      canStart: false,
      externalJobName: "must-not-leak",
    } as EmployeeSyncStatus));
    const response = await GET();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.externalJobName, undefined);
  });
});
