import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const UNIT_ID = "00000000-0000-4000-8000-000000000002";
const REPORT_ID = "00000000-0000-4000-8000-000000000003";
const PROGRAM_ID = "00000000-0000-4000-8000-000000000004";
const OLD_FILE = "reports/" + UNIT_ID + "/2026/06/00000000-0000-4000-8000-000000000005.jpg";
const NEW_FILE = "reports/" + UNIT_ID + "/2026/06/00000000-0000-4000-8000-000000000006.jpg";
const SECOND_NEW_FILE = "reports/" + UNIT_ID + "/2026/06/00000000-0000-4000-8000-000000000007.jpg";
const VERSION = "2026-06-10T12:00:00.000Z";

class TestApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
class TestUploadLifecycleError extends Error {}

const authMock = mock.fn(async () => ({
  user: { id: USER_ID, name: "PIC", role: "PIC", unitId: UNIT_ID },
}));
const reportFindUniqueMock = mock.fn(async () => report());
const lockedReportFindUniqueMock = mock.fn(async () => report());
const userFindFirstMock = mock.fn(async (): Promise<{ id: string } | null> => ({ id: USER_ID }));
const programFindUniqueMock = mock.fn(async () => ({
  isActive: true,
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-12-31"),
  uploadDeadline: new Date("2026-12-31"),
  category: {
    targetUnit: "PARTISIPASI_PERSEN",
    evidenceMode: "PHOTO_WITHOUT_AI",
    scoreInputMode: "DIRECT_ADMIN",
  },
}));
const duplicateFindFirstMock = mock.fn(async (): Promise<{ id: string } | null> => null);
const updateManyMock = mock.fn(async () => ({ count: 1 }));
const updateMock = mock.fn(async () => ({ id: REPORT_ID, status: "PENDING" }));
const logCreateMock = mock.fn(async () => ({ id: "log-1" }));
const photoDeleteManyMock = mock.fn(async () => ({ count: 1 }));
const transactionRollbackCount = { value: 0 };
let lifecyclePlan: unknown;
let transactionClient: any;
const lifecycle = Object.freeze({ phase: "locked" });

const withLifecycleTransactionMock = mock.fn(
  async (_client: unknown, plan: unknown, callback: (value: unknown) => Promise<unknown>) => {
    lifecyclePlan = plan;
    try {
      return await callback(lifecycle);
    } catch (error) {
      transactionRollbackCount.value += 1;
      throw error;
    }
  },
);
const contextMock = mock.fn((value: unknown) => value as object);
const verifyNewUploadMock = mock.fn(
  (descriptor: string, cleanupToken: string, context: any) => {
    if (descriptor !== "signed-descriptor" || cleanupToken !== "signed-cleanup") {
      throw new TestUploadLifecycleError("invalid upload");
    }
    return { publicId: context.publicId };
  },
);
const readVerifiedNewUploadMock = mock.fn((handle: any) => ({
  publicId: handle.publicId,
  url: "/uploads/" + handle.publicId,
}));
const findUploadReferencesMock = mock.fn(async () => [] as unknown[]);
const rollbackVerifiedNewUploadMock = mock.fn(async () => ({ kind: "deleted" }));
const captureActivityPhotoOwnerMock = mock.fn(async () => ({ phase: "owner" }));
const capturePersistedOldCleanupMock = mock.fn(() => ({ phase: "cleanup", fileKey: OLD_FILE }));
const readPersistedOldCleanupMock = mock.fn((cleanup: any) => cleanup);
const cleanupPersistedOldUploadMock = mock.fn(async () => ({ kind: "deleted" }));
const getCapabilityErrorMock = mock.fn(() => null as string | null);
const resolveUploadReferenceMock = mock.fn(async (url: string) => ({
  kind: "local",
  exists: true,
  isRegularFile: true,
  storageKey: url.replace("/uploads/", ""),
}));
const isProgramUploadOpenMock = mock.fn(() => true);
const isActivityDateInsideProgramMock = mock.fn(() => true);
function report(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    createdById: USER_ID,
    unitId: UNIT_ID,
    programId: PROGRAM_ID,
    status: "REJECTED",
    activityName: "Kegiatan lama",
    tanggalKegiatan: new Date("2026-06-01T00:00:00.000Z"),
    lokasi: "Aula",
    description: "Dokumentasi kegiatan",
    updatedAt: new Date(VERSION),
    photos: [
      {
        id: 17,
        publicId: OLD_FILE,
        imageUrl: "/uploads/" + OLD_FILE,
        originalName: "lama.jpg",
      },
    ],
    ...overrides,
  };
}

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: TestApiError,
    requirePic: authMock,
    requireAuth: authMock,
    handleApiError: (error: unknown) =>
      Response.json(
        {
          success: false,
          error: true,
          status: error instanceof TestApiError ? error.status : 500,
          message: error instanceof Error ? error.message : "internal",
          data: null,
        },
        { status: error instanceof TestApiError ? error.status : 500 },
      ),
  },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      activityReport: { findUnique: reportFindUniqueMock },
      user: { findFirst: userFindFirstMock },
      programBudaya: { findUnique: programFindUniqueMock },
    },
  },
});
mock.module("@/lib/program-period", {
  namedExports: {
    isProgramUploadOpen: isProgramUploadOpenMock,
    isActivityDateInsideProgram: isActivityDateInsideProgramMock,
  },
});
mock.module("@/lib/program-capabilities", {
  namedExports: {
    getCapabilityError: getCapabilityErrorMock,
    requiresEvidence: () => true,
  },
});
mock.module("@/lib/response", {
  namedExports: {
    errorResponse: (message: string, status: number, data: unknown = null) => ({
      success: false,
      error: true,
      status,
      message,
      data,
    }),
    formatZodError: (error: Error) => error.message,
    successResponse: (data: unknown, message: string) => ({
      success: true,
      error: false,
      data,
      message,
    }),
  },
});
mock.module("@/lib/api/upload-storage", {
  namedExports: {
    classifyStorageKey: (key: string) =>
      key.startsWith("reports/") && key.split("/").length === 5 ? "report" : null,
    classifyManagedStorageKey: (key: string) =>
      key.startsWith("reports/") && key.split("/").length === 5 ? "report" : null,
    classifyUploadReference: (reference: string) => {
      if (reference.startsWith("https://") || reference.startsWith("http://")) {
        return { kind: "external-http", url: reference };
      }
      if (!reference.startsWith("/uploads/")) return { kind: "unsafe", reason: "test" };
      const storageKey = reference.slice("/uploads/".length);
      return {
        kind: "local",
        storageKey,
        source: storageKey.split("/").length === 5 ? "report" : "legacy-flat",
      };
    },
    resolveUploadReference: resolveUploadReferenceMock,
  },
});
mock.module("@/lib/api/upload-lifecycle", {
  namedExports: {
    UploadLifecycleError: TestUploadLifecycleError,
    captureActivityPhotoOwner: captureActivityPhotoOwnerMock,
    capturePersistedOldCleanup: capturePersistedOldCleanupMock,
    cleanupPersistedOldUploadAfterCommit: cleanupPersistedOldUploadMock,
    createServerOwnedUploadContext: contextMock,
    findUploadReferences: findUploadReferencesMock,
    getUploadLifecycleTransaction: () => transactionClient,
    matchesExpectedUpdatedAt: (value: string, actual: Date) =>
      new Date(value).getTime() === actual.getTime() &&
      new Date(value).toISOString() === value,
    parseExpectedUpdatedAt: (value: unknown) => {
      if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
        throw new TestUploadLifecycleError("bad timestamp");
      }
      const date = new Date(value);
      if (date.toISOString() !== value) throw new TestUploadLifecycleError("bad timestamp");
      return date;
    },
    readVerifiedNewUpload: readVerifiedNewUploadMock,
    readPersistedOldCleanup: readPersistedOldCleanupMock,
    rollbackVerifiedNewUpload: rollbackVerifiedNewUploadMock,
    verifyNewUpload: verifyNewUploadMock,
    withUploadLifecycleTransaction: withLifecycleTransactionMock,
  },
});

let PUT: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
before(async () => {
  ({ PUT } = await import("./route"));
});
beforeEach(() => {
  for (const fn of [
    authMock,
    reportFindUniqueMock,
    lockedReportFindUniqueMock,
    userFindFirstMock,
    programFindUniqueMock,
    duplicateFindFirstMock,
    updateManyMock,
    updateMock,
    logCreateMock,
    photoDeleteManyMock,
    withLifecycleTransactionMock,
    contextMock,
    verifyNewUploadMock,
    readVerifiedNewUploadMock,
    findUploadReferencesMock,
    rollbackVerifiedNewUploadMock,
    captureActivityPhotoOwnerMock,
    capturePersistedOldCleanupMock,
    readPersistedOldCleanupMock,
    cleanupPersistedOldUploadMock,
    getCapabilityErrorMock,
    resolveUploadReferenceMock,
    isProgramUploadOpenMock,
    isActivityDateInsideProgramMock,
  ]) fn.mock.resetCalls();

  transactionRollbackCount.value = 0;
  lifecyclePlan = undefined;
  reportFindUniqueMock.mock.mockImplementation(async () => report());
  lockedReportFindUniqueMock.mock.mockImplementation(async () => report());
  userFindFirstMock.mock.mockImplementation(async () => ({ id: USER_ID }));
  programFindUniqueMock.mock.mockImplementation(async () => ({
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    uploadDeadline: new Date("2026-12-31"),
    category: {
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "PHOTO_WITHOUT_AI",
      scoreInputMode: "DIRECT_ADMIN",
    },
  }));
  duplicateFindFirstMock.mock.mockImplementation(async () => null);
  updateManyMock.mock.mockImplementation(async () => ({ count: 1 }));
  updateMock.mock.mockImplementation(async () => ({ id: REPORT_ID, status: "PENDING" }));
  userFindFirstMock.mock.mockImplementation(async () => ({ id: USER_ID }));
  withLifecycleTransactionMock.mock.mockImplementation(async (_client, plan, callback) => {
    lifecyclePlan = plan;
    try {
      return await callback(lifecycle);
    } catch (error) {
      transactionRollbackCount.value += 1;
      throw error;
    }
  });
  resolveUploadReferenceMock.mock.mockImplementation(async (url) => ({
    kind: "local",
    exists: true,
    isRegularFile: true,
    storageKey: url.replace("/uploads/", ""),
  }));
  findUploadReferencesMock.mock.mockImplementation(async () => []);
  isProgramUploadOpenMock.mock.mockImplementation(() => true);
  isActivityDateInsideProgramMock.mock.mockImplementation(() => true);
  getCapabilityErrorMock.mock.mockImplementation(() => null);

  transactionClient = {
    activityReport: {
      findUnique: lockedReportFindUniqueMock,
      findFirst: duplicateFindFirstMock,
      updateMany: updateManyMock,
      update: updateMock,
    },
    activityPhoto: { deleteMany: photoDeleteManyMock },
    activityLog: { create: logCreateMock },
    user: { findFirst: userFindFirstMock },
    programBudaya: { findUnique: programFindUniqueMock },
  };
});

function request(
  photos: number | null = 1,
  lastSubmittedAt?: string,
  imageUrl = "https://attacker.invalid/forged.jpg",
) {
  const body = {
    activityName: "Kegiatan budaya",
    tanggalKegiatan: "2026-06-01",
    lokasi: "Aula",
    description: "Dokumentasi kegiatan budaya",
    expectedUpdatedAt: VERSION,
    ...(photos === null
      ? {}
      : {
          photos: Array.from({ length: photos }, (_, index) => ({
            originalName: "baru-" + index + ".jpg",
            imageUrl,
            publicId: index === 0 ? NEW_FILE : SECOND_NEW_FILE,
            descriptor: "signed-descriptor",
            cleanupToken: "signed-cleanup",
          })),
        }),
    ...(lastSubmittedAt !== undefined ? { lastSubmittedAt } : {}),
  };
  return new NextRequest("http://localhost/api/reports/" + REPORT_ID, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function run(
  photos: number | null = 1,
  lastSubmittedAt?: string,
  imageUrl?: string,
) {
  return PUT(request(photos, lastSubmittedAt, imageUrl), {
    params: Promise.resolve({ id: REPORT_ID }),
  });
}

test("resubmit membatasi creator, unit, dan report rejected sebelum transaksi", async () => {
  reportFindUniqueMock.mock.mockImplementationOnce(async () =>
    report({ createdById: "00000000-0000-4000-8000-000000000099" }),
  );
  assert.equal((await run()).status, 403);
  reportFindUniqueMock.mock.mockImplementationOnce(async () => report({ unitId: "00000000-0000-4000-8000-000000000099" }));
  assert.equal((await run()).status, 403);
  reportFindUniqueMock.mock.mockImplementationOnce(async () => report({ status: "PENDING" }));
  assert.equal((await run()).status, 409);
  assert.equal(withLifecycleTransactionMock.mock.callCount(), 0);
});

test("menolak bukti pengganti dengan capability invalid sebelum transaksi", async () => {
  verifyNewUploadMock.mock.mockImplementationOnce(() => {
    throw new TestUploadLifecycleError("invalid upload");
  });
  assert.equal((await run()).status, 400);
  assert.equal(withLifecycleTransactionMock.mock.callCount(), 0);
});

test("resubmit keeps ID, uses server timestamp, persists canonical URL, and cleans managed old file", async () => {
  const response = await run(1, "2000-01-01T00:00:00.000Z");
  assert.equal(response.status, 200);

  const context = (contextMock.mock.calls as any)[0].arguments[0];
  assert.deepEqual(context, {
    userId: USER_ID,
    purpose: "EVIDENCE",
    mode: "REPLACEMENT",
    publicId: NEW_FILE,
    unitId: UNIT_ID,
    reportId: REPORT_ID,
  });
  assert.equal(verifyNewUploadMock.mock.callCount(), 2);
  assert.deepEqual((updateManyMock.mock.calls as any)[0].arguments[0].where, {
    id: REPORT_ID,
    status: "REJECTED",
    updatedAt: new Date(VERSION),
  });

  const updateArgs = (updateMock.mock.calls as any)[0].arguments[0];
  assert.equal(updateArgs.data.photos.create[0].imageUrl, "/uploads/" + NEW_FILE);
  assert.equal(updateArgs.data.photos.create[0].publicId, NEW_FILE);
  const transition = (updateManyMock.mock.calls as any)[0].arguments[0];
  assert.equal(
    updateArgs.data.updatedAt.toISOString(),
    transition.data.lastSubmittedAt.toISOString(),
  );
  assert.equal(
    (logCreateMock.mock.calls as any)[0].arguments[0].data.createdAt.toISOString(),
    transition.data.lastSubmittedAt.toISOString(),
  );
  assert.equal((updateMock.mock.calls as any)[0].arguments[0].where.id, REPORT_ID);
  assert.equal(updateArgs.data.photos.create[0].imageUrl.includes("attacker.invalid"), false);
  assert.equal(photoDeleteManyMock.mock.callCount(), 1);
  assert.equal(logCreateMock.mock.callCount(), 1);
  assert.equal(captureActivityPhotoOwnerMock.mock.callCount(), 1);
  assert.equal(cleanupPersistedOldUploadMock.mock.callCount(), 1);

  const plan = lifecyclePlan as any;
  assert.ok(plan.entities.some((entity: any) => entity.model === "ActivityReport" && entity.id === REPORT_ID));
  assert.ok(plan.entities.some((entity: any) => entity.model === "ProgramBudaya" && entity.id === PROGRAM_ID));
  assert.ok(plan.entities.some((entity: any) => entity.model === "Unit" && entity.id === UNIT_ID));
  assert.ok(plan.entities.some((entity: any) => entity.model === "ActivityPhoto" && entity.id === "17"));
  assert.deepEqual(plan.fileKeys.sort(), [NEW_FILE, OLD_FILE].sort());
});

test("logs exact old file key when post-commit cleanup fails and preserves success", async () => {
  cleanupPersistedOldUploadMock.mock.mockImplementationOnce(async () => ({
    kind: "failed",
    fileKey: OLD_FILE,
  }));
  const captured: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => captured.push(args);
  let response: Response;
  try {
    response = await run();
  } finally {
    console.error = originalError;
  }

  assert.equal(response!.status, 200);
  assert.deepEqual(captured[0], [
    "[PUT /api/reports/[id]] upload cleanup failed",
    { phase: "post-commit-old-file", fileKey: OLD_FILE },
  ]);
});

test("one or two distinct replacement photos are accepted", async () => {
  assert.equal((await run(2)).status, 200);
  assert.equal(verifyNewUploadMock.mock.callCount(), 4);
});

test("stale report version from locked reread returns 409 before mutation", async () => {
  lockedReportFindUniqueMock.mock.mockImplementationOnce(async () =>
    report({ updatedAt: new Date("2026-06-11T12:00:00.000Z") }),
  );
  assert.equal((await run()).status, 409);
  assert.equal(updateManyMock.mock.callCount(), 0);
  assert.equal(photoDeleteManyMock.mock.callCount(), 0);
  assert.equal(logCreateMock.mock.callCount(), 0);
  assert.equal(verifyNewUploadMock.mock.callCount(), 1);
});

test("active PIC is checked again inside the locked transaction", async () => {
  let activeLookupCount = 0;
  userFindFirstMock.mock.mockImplementation(async () => {
    activeLookupCount += 1;
    return activeLookupCount === 1 ? { id: USER_ID } : null;
  });
  assert.equal((await run()).status, 403);
  assert.equal(userFindFirstMock.mock.callCount(), 2);
  assert.equal(verifyNewUploadMock.mock.callCount(), 1);
});

test("locked photo snapshot changes fail closed before replacement", async () => {
  lockedReportFindUniqueMock.mock.mockImplementationOnce(async () =>
    report({
      photos: [
        {
          id: 18,
          publicId: "legacy.jpg",
          imageUrl: "https://example.invalid/replaced.jpg",
          originalName: "replaced.jpg",
        },
      ],
    }),
  );
  assert.equal((await run()).status, 409);
  assert.equal(verifyNewUploadMock.mock.callCount(), 1);
  assert.equal(photoDeleteManyMock.mock.callCount(), 0);
});

test("pre-transaction file validation rejects unresolved upload and rolls it back", async () => {
  resolveUploadReferenceMock.mock.mockImplementationOnce(async () => ({
    kind: "missing",
    exists: false,
    isRegularFile: false,
    storageKey: NEW_FILE,
  }));
  assert.equal((await run()).status, 400);
  assert.equal(transactionRollbackCount.value, 0);
  assert.equal(rollbackVerifiedNewUploadMock.mock.callCount(), 1);
  assert.equal(updateManyMock.mock.callCount(), 0);
});

test("already referenced replacement file returns conflict and rolls back upload", async () => {
  findUploadReferencesMock.mock.mockImplementationOnce(async () => [{ owner: {} }]);
  assert.equal((await run()).status, 409);
  assert.equal(rollbackVerifiedNewUploadMock.mock.callCount(), 1);
  assert.equal(photoDeleteManyMock.mock.callCount(), 0);
});

test("DIRECT_ADMIN duplicate is checked under the shared program and unit locks", async () => {
  duplicateFindFirstMock.mock.mockImplementationOnce(async () => ({ id: "other-report" }));
  assert.equal((await run()).status, 409);
  assert.equal(updateManyMock.mock.callCount(), 0);
  assert.equal(photoDeleteManyMock.mock.callCount(), 0);
});

test("stale CAS and failed database write roll back new upload and never commit log", async () => {
  updateManyMock.mock.mockImplementationOnce(async () => ({ count: 0 }));
  assert.equal((await run()).status, 409);
  assert.equal(logCreateMock.mock.callCount(), 0);
  assert.equal(rollbackVerifiedNewUploadMock.mock.callCount(), 1);

  updateMock.mock.mockImplementationOnce(async () => {
    throw new Error("downstream failure");
  });
  assert.equal((await run()).status, 500);
  assert.equal(transactionRollbackCount.value, 2);
  assert.equal(logCreateMock.mock.callCount(), 0);
  assert.equal(rollbackVerifiedNewUploadMock.mock.callCount(), 2);
});

test("only one parallel resubmit wins the compare-and-set", async () => {
  let available = true;
  updateManyMock.mock.mockImplementation(async () => {
    if (!available) return { count: 0 };
    available = false;
    return { count: 1 };
  });
  const responses = await Promise.all([run(), run()]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(updateMock.mock.callCount(), 1);
  assert.equal(logCreateMock.mock.callCount(), 1);
});

test("omitting photos retains existing photo rows and legacy/external old files are not cleaned", async () => {
  reportFindUniqueMock.mock.mockImplementation(async () =>
    report({
      photos: [
        {
          id: 17,
          publicId: "old.jpg",
          imageUrl: "https://external.invalid/old.jpg",
          originalName: "old.jpg",
        },
      ],
    }),
  );
  lockedReportFindUniqueMock.mock.mockImplementation(async () =>
    report({
      photos: [
        {
          id: 17,
          publicId: "old.jpg",
          imageUrl: "https://external.invalid/old.jpg",
          originalName: "old.jpg",
        },
      ],
    }),
  );
  assert.equal((await run(null)).status, 200);
  assert.equal(photoDeleteManyMock.mock.callCount(), 0);
  assert.equal(captureActivityPhotoOwnerMock.mock.callCount(), 0);
  assert.equal(cleanupPersistedOldUploadMock.mock.callCount(), 0);
});

test("zero or three replacement photos, invalid capability, or closed windows are rejected", async () => {
  assert.equal((await run(0)).status, 400);
  assert.equal((await run(3)).status, 400);

  getCapabilityErrorMock.mock.mockImplementationOnce(() => "Invalid capability");
  programFindUniqueMock.mock.mockImplementationOnce(async () => ({
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    uploadDeadline: new Date("2026-12-31"),
    category: {
      targetUnit: "KEGIATAN",
      evidenceMode: "PHOTO_WITHOUT_AI",
      scoreInputMode: "DIRECT_ADMIN",
    },
  }));
  assert.equal((await run()).status, 422);

  isProgramUploadOpenMock.mock.mockImplementationOnce(() => false);
  assert.equal((await run()).status, 403);
});
