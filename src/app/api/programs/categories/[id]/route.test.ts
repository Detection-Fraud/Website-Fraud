import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { NextRequest } from "next/server";

const category = {
  id: "category-1",
  name: "Category",
  bannerUrl: null,
  targetUnit: "KEGIATAN",
  evidenceMode: "NONE",
  scoreInputMode: "NONE",
  updatedAt: new Date("2026-09-25T06:14:08.664Z"),
};
const findUnique = mock.fn(async () => category);
const deleteCategory = mock.fn(async () => category);
const countZero = mock.fn(async () => 0);
const tx = {
  programCategory: { findUnique, delete: deleteCategory },
  programBudaya: { count: countZero },
  activityReport: { count: countZero },
  participationData: { count: countZero },
  participationScoreHistory: { count: countZero },
};
const prismaMock = {
  programCategory: { findUnique: mock.fn(async () => ({ id: category.id, bannerUrl: null })) },
  $transaction: mock.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
};

class TestApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: TestApiError,
    requireAdmin: async () => ({ user: { id: "admin-1", role: "ADMIN" } }),
    handleApiError: (error: unknown, _context: string) =>
      Response.json({ error: true }, { status: error instanceof TestApiError ? error.status : 500 }),
  },
});
mock.module("@/lib/prisma", { namedExports: { prisma: prismaMock } });
mock.module("@/lib/api/upload-lifecycle", {
  namedExports: {
    withUploadLifecycleTransaction: async (
      _client: unknown,
      _plan: unknown,
      callback: (lifecycle: object) => Promise<unknown>,
    ) => callback({}),
    getUploadLifecycleTransaction: () => tx,
    parseExpectedUpdatedAt: (value: string) => {
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new Error("invalid");
      return parsed;
    },
    findUploadReferences: async () => [],
    captureProgramCategoryOwner: async () => ({}),
    capturePersistedOldCleanup: () => ({}),
    cleanupPersistedOldUploadAfterCommit: async () => ({ kind: "missing" }),
    createServerOwnedUploadContext: () => ({}),
    readVerifiedNewUpload: () => ({}),
    rollbackVerifiedNewUpload: async () => ({ kind: "missing" }),
    verifyNewUpload: () => ({}),
  },
});
mock.module("@/lib/api/upload-storage", {
  namedExports: {
    classifyUploadReference: () => ({ kind: "unsafe", reason: "unused" }),
    resolveUploadReference: async () => ({ kind: "missing", storageKey: "", source: "banner-categories" }),
  },
});
mock.module("@/lib/program-capabilities", {
  namedExports: { getCapabilityError: () => null },
});

const { DELETE } = await import("./route");
const params = { params: Promise.resolve({ id: category.id }) };

function deleteRequest(body?: unknown) {
  return new NextRequest("http://localhost/api/programs/categories/category-1", {
    method: "DELETE",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { "content-type": "application/json" },
  });
}

test("DELETE requires a canonical expectedUpdatedAt before database access", async () => {
  const before = prismaMock.programCategory.findUnique.mock.callCount();
  const response = await DELETE(deleteRequest(), params);
  assert.equal(response.status, 400);
  assert.equal(prismaMock.programCategory.findUnique.mock.callCount(), before);
});

test("DELETE uses the locked row version and removes an unused category", async () => {
  const response = await DELETE(
    deleteRequest({ expectedUpdatedAt: category.updatedAt.toISOString() }),
    params,
  );
  assert.equal(response.status, 200);
  assert.equal(deleteCategory.mock.callCount(), 1);
});

test("DELETE rejects a stale expectedUpdatedAt before usage checks or mutation", async () => {
  const beforeCount = countZero.mock.callCount();
  const response = await DELETE(
    deleteRequest({ expectedUpdatedAt: "2026-09-24T06:14:08.664Z" }),
    params,
  );
  assert.equal(response.status, 409);
  assert.equal(countZero.mock.callCount(), beforeCount);
  assert.equal(deleteCategory.mock.callCount(), 1);
});
