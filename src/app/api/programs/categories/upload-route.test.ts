import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

class TestApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const ADMIN = { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "ADMIN" } };
const CATEGORY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UPDATED_AT = new Date("2026-09-25T06:14:08.664Z");
const NEW_KEY = "banners/categories/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg";
const OLD_KEY = "banners/categories/dddddddd-cccc-4ccc-8ccc-cccccccccccc.jpg";
const NEW_URL = `/uploads/${NEW_KEY}`;

let isAdmin = true;
let row: Record<string, unknown>;
let createdData: Record<string, unknown> | undefined;
let updatedData: Record<string, unknown> | undefined;
let verifiedContext: Record<string, unknown> | undefined;
let transactionPlan: { entities: unknown[]; fileKeys: string[] } | undefined;
let referenceCalls = 0;
let referenceResult: Array<{ owner: { kind: string; id: string } }> = [];
let cleanupCaptureCalls = 0;
let cleanupCalls = 0;
let rollbackCalls = 0;
let rejectWrongPurposeReceipt = false;
let resolveCallCount = 0;
let invalidLockedFile: "missing" | "non-regular" | null = null;

const tx = {
  programCategory: {
    findUnique: mock.fn(async (args: { where?: { name?: string } }) => args.where?.name ? null : row),
    create: mock.fn(async ({ data }: { data: Record<string, unknown> }) => {
      createdData = data;
      return { ...data, id: CATEGORY_ID, updatedAt: UPDATED_AT };
    }),
    update: mock.fn(async ({ data }: { data: Record<string, unknown> }) => {
      updatedData = data;
      row = { ...row, ...data, updatedAt: UPDATED_AT };
      return row;
    }),
  },
  programBudaya: { count: mock.fn(async () => 0) },
  activityReport: { count: mock.fn(async () => 0) },
  participationData: { count: mock.fn(async () => 0) },
  participationScoreHistory: { count: mock.fn(async () => 0) },
};

const prisma = {
  programCategory: {
    findUnique: mock.fn(async () => row),
  },
};

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: TestApiError,
    requireAdmin: async () => {
      if (!isAdmin) throw new TestApiError("Admin required", 403);
      return ADMIN;
    },
    requireAuth: async () => ADMIN,
    handleApiError: (error: unknown) => {
      const status = error instanceof TestApiError ? error.status : 500;
      return Response.json({ error: true, message: error instanceof Error ? error.message : "error" }, { status });
    },
  },
});
mock.module("@/lib/prisma", { namedExports: { prisma } });
mock.module("@/lib/api/category-usage", {
  namedExports: {
    getCategoryUsageByCategoryIds: async () => new Map(),
    getCategoryLocks: () => ({ capability: false, deletion: false }),
  },
});
mock.module("@/lib/program-capabilities", {
  namedExports: { getCapabilityError: () => null },
});
mock.module("@/lib/api/upload-lifecycle", {
  namedExports: {
    createServerOwnedUploadContext: (context: Record<string, unknown>) => {
      verifiedContext = context;
      return context;
    },
    verifyNewUpload: (descriptor: string, _cleanupToken: string, context: Record<string, unknown>) => {
      if (rejectWrongPurposeReceipt && descriptor === "signed-for-program-banner") throw new Error("PURPOSE_MISMATCH");
      return { descriptor, context };
    },
    readVerifiedNewUpload: (upload: { context: { publicId: string } }) => ({
      publicId: upload.context.publicId,
      url: `/uploads/${upload.context.publicId}`,
    }),
    rollbackVerifiedNewUpload: async () => {
      rollbackCalls += 1;
      return { kind: "deleted" };
    },
    withUploadLifecycleTransaction: async (
      _client: unknown,
      plan: typeof transactionPlan,
      callback: (lifecycle: object) => Promise<unknown>,
    ) => {
      transactionPlan = plan;
      return callback({});
    },
    getUploadLifecycleTransaction: () => tx,
    findUploadReferences: async () => {
      referenceCalls += 1;
      return referenceResult;
    },
    captureProgramCategoryOwner: async () => ({ owner: true }),
    capturePersistedOldCleanup: () => {
      cleanupCaptureCalls += 1;
      return { cleanup: true };
    },
    cleanupPersistedOldUploadAfterCommit: async () => {
      cleanupCalls += 1;
      return { kind: "deleted" };
    },
    parseExpectedUpdatedAt: (value: string) => {
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw new Error("invalid version");
      return parsed;
    },
    UploadLifecycleError: class extends Error {},
  },
});
mock.module("@/lib/api/upload-storage", {
  namedExports: {
    resolveUploadReference: async (url: string) => {
      resolveCallCount += 1;
      if (invalidLockedFile && resolveCallCount > 1 && invalidLockedFile === "missing") {
        return { kind: "missing", storageKey: url.slice("/uploads/".length), source: "banner-categories" };
      }
      return {
        kind: "local",
        storageKey: url.slice("/uploads/".length),
        source: "banner-categories",
        exists: true,
        isRegularFile: !(invalidLockedFile && resolveCallCount > 1 && invalidLockedFile === "non-regular"),
      };
    },
    classifyUploadReference: (value: string) => {
      if (value.startsWith("https://")) return { kind: "external-http", url: value };
      if (value.startsWith("/uploads/legacy-")) return { kind: "local", storageKey: value.slice("/uploads/".length), source: "legacy-flat" };
      return { kind: "local", storageKey: value.slice("/uploads/".length), source: "banner-categories" };
    },
  },
});

let POST: typeof import("./route").POST;
let PUT: typeof import("./[id]/route").PUT;

before(async () => {
  ({ POST } = await import("./route"));
  ({ PUT } = await import("./[id]/route"));
});

const capability = {
  targetUnit: "PARTISIPASI_PERSEN",
  evidenceMode: "NONE",
  scoreInputMode: "EXCEL_IMPORT",
};

function resetState(bannerUrl: string | null = null) {
  isAdmin = true;
  row = {
    id: CATEGORY_ID,
    name: "Kategori Awal",
    bannerUrl,
    ...capability,
    defaultFrequency: 1,
    updatedAt: UPDATED_AT,
  };
  createdData = undefined;
  updatedData = undefined;
  verifiedContext = undefined;
  transactionPlan = undefined;
  referenceCalls = 0;
  referenceResult = [];
  cleanupCaptureCalls = 0;
  cleanupCalls = 0;
  rollbackCalls = 0;
  rejectWrongPurposeReceipt = false;
  resolveCallCount = 0;
  invalidLockedFile = null;
}

function request(method: string, body: unknown) {
  return new NextRequest("http://localhost/api/programs/categories", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Kategori Upload",
    ...capability,
    defaultFrequency: 1,
    bannerState: "REPLACED",
    bannerUrl: "https://client.example/untrusted.jpg",
    bannerPublicId: NEW_KEY,
    bannerDescriptor: "valid-descriptor",
    bannerCleanupToken: "valid-cleanup",
    ...overrides,
  };
}

function updatePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Kategori Diubah",
    bannerState: "REPLACED",
    bannerUrl: "https://client.example/untrusted.jpg",
    bannerPublicId: NEW_KEY,
    bannerDescriptor: "valid-descriptor",
    bannerCleanupToken: "valid-cleanup",
    expectedUpdatedAt: UPDATED_AT.toISOString(),
    ...overrides,
  };
}

test("POST requires an admin before reading or mutating category data", async () => {
  resetState();
  isAdmin = false;
  const response = await POST(request("POST", createPayload()));
  assert.equal(response.status, 403);
  assert.equal(createdData, undefined);
  assert.equal(verifiedContext, undefined);
});

test("POST verifies CATEGORY_BANNER/CREATE and persists only the verified canonical URL", async () => {
  resetState();
  const response = await POST(request("POST", createPayload()));
  assert.equal(response.status, 201);
  assert.deepEqual(verifiedContext, {
    userId: ADMIN.user.id,
    purpose: "CATEGORY_BANNER",
    mode: "CREATE",
    publicId: NEW_KEY,
  });
  assert.equal(createdData?.bannerUrl, NEW_URL);
  assert.deepEqual(transactionPlan?.fileKeys, [NEW_KEY]);
});

test("POST revalidates the file under its lifecycle lock and rolls back if it disappeared", async () => {
  for (const invalidFile of ["missing", "non-regular"] as const) {
    resetState();
    invalidLockedFile = invalidFile;
    const response = await POST(request("POST", createPayload()));
    assert.equal(response.status, 422);
    assert.equal(resolveCallCount, 2);
    assert.equal(createdData, undefined);
    assert.equal(rollbackCalls, 1);
  }
});

test("POST rejects unpaired receipts and receipts signed for another purpose", async () => {
  resetState();
  const unpaired = await POST(request("POST", createPayload({ bannerCleanupToken: undefined })));
  assert.equal(unpaired.status, 400);
  assert.equal(verifiedContext, undefined);

  resetState();
  rejectWrongPurposeReceipt = true;
  const wrongPurpose = await POST(request("POST", createPayload({ bannerDescriptor: "signed-for-program-banner" })));
  assert.equal(wrongPurpose.status, 422);
  assert.equal(createdData, undefined);
});

test("POST returns 400 for create-only disallowed banner states without a receipt", async () => {
  for (const bannerState of ["UNCHANGED", "REMOVED"] as const) {
    resetState();
    const response = await POST(request("POST", createPayload({
      bannerState,
      bannerPublicId: undefined,
      bannerDescriptor: undefined,
      bannerCleanupToken: undefined,
    })));
    assert.equal(response.status, 400);
    assert.equal(verifiedContext, undefined);
    assert.equal(createdData, undefined);
  }
});

test("PUT replaces with the verified URL and rolls back a verified upload on stale version", async () => {
  resetState(`/uploads/${OLD_KEY}`);
  const success = await PUT(request("PUT", updatePayload()), { params: Promise.resolve({ id: CATEGORY_ID }) });
  assert.equal(success.status, 200);
  assert.equal(verifiedContext?.purpose, "CATEGORY_BANNER");
  assert.equal(verifiedContext?.mode, "REPLACEMENT");
  assert.equal(updatedData?.bannerUrl, NEW_URL);
  assert.deepEqual(transactionPlan?.fileKeys, [OLD_KEY, NEW_KEY]);
  assert.equal(cleanupCalls, 1);

  resetState();
  const stale = await PUT(
    request("PUT", updatePayload({ expectedUpdatedAt: "2026-09-24T06:14:08.664Z" })),
    { params: Promise.resolve({ id: CATEGORY_ID }) },
  );
  assert.equal(stale.status, 409);
  assert.equal(rollbackCalls, 1);
  assert.equal(updatedData, undefined);
});

test("PUT preserves legacy and external old URLs without attempting cleanup", async () => {
  for (const oldUrl of ["/uploads/legacy-banner.jpg", "https://cdn.example/old-banner.jpg"]) {
    resetState(oldUrl);
    const response = await PUT(
      request("PUT", updatePayload({
        bannerState: "UNCHANGED",
        bannerUrl: "https://client.example/forged.jpg",
        bannerPublicId: undefined,
        bannerDescriptor: undefined,
        bannerCleanupToken: undefined,
      })),
      { params: Promise.resolve({ id: CATEGORY_ID }) },
    );
    assert.equal(response.status, 200);
    assert.equal(updatedData?.bannerUrl, oldUrl);
    assert.equal(cleanupCaptureCalls, 0);
    assert.equal(cleanupCalls, 0);
  }
});
