import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import type { advanceEmployeePentahoSync } from "@/lib/employee-sync-orchestrator";
import type { EmployeeSyncStatus } from "@/types/employee-sync.types";

const requireAdminMock = mock.fn(async () => ({ user: { id: "admin-1", role: "ADMIN" } }));
const advanceMock = mock.fn<typeof advanceEmployeePentahoSync>(async () => ({
  runId: "00000000-0000-4000-8000-000000000001",
  sourceSystem: "PENTAHO",
  status: "SUCCEEDED" as const,
  phase: "COMPLETED" as const,
  startedAt: "2026-09-22T00:00:00.000Z",
  completedAt: "2026-09-22T00:05:00.000Z",
  deadlineAt: "2026-09-22T00:30:00.000Z",
  receivedCount: 10,
  processedCount: 10,
  missingCount: 0,
  deactivatedCount: 0,
  errorMessage: null,
  canStart: true,
  responseMetadata: { secret: "must-not-leak" },
} as EmployeeSyncStatus));

mock.module("@/lib/api/auth-guard", {
  namedExports: { requireAdmin: requireAdminMock, ApiError: class ApiError extends Error {} },
});
mock.module("@/lib/employee-sync-orchestrator", {
  namedExports: { advanceEmployeePentahoSync: advanceMock },
});

let POST: (request: Request, context: { params: Promise<{ runId: string }> }) => Promise<Response>;

before(async () => {
  ({ POST } = await import("./route"));
});

describe("POST /api/employees/sync/[runId]/advance", () => {
  it("rejects an invalid UUID before advancing", async () => {
    advanceMock.mock.resetCalls();
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ runId: "not-a-uuid" }),
    });
    assert.equal(response.status, 400);
    assert.equal(advanceMock.mock.callCount(), 0);
  });

  it("awaits params, advances the run, and returns only safe status data", async () => {
    advanceMock.mock.resetCalls();
    const runId = "00000000-0000-4000-8000-000000000001";
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ runId }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(advanceMock.mock.calls[0]?.arguments, [runId]);
    assert.equal(body.data.responseMetadata, undefined);
  });

  it("maps a missing run to a sanitized 404", async () => {
    advanceMock.mock.mockImplementationOnce(async () => {
      throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
    });
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({
        runId: "00000000-0000-4000-8000-000000000001",
      }),
    });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).data, null);
  });

  it("returns 202 while the run is still pending", async () => {
    advanceMock.mock.mockImplementationOnce(async () => ({
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
    } as EmployeeSyncStatus));
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({
        runId: "00000000-0000-4000-8000-000000000001",
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 202);
    assert.equal(body.status, 202);
  });
});
