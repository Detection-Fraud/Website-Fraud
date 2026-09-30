import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

const VERSION = "2026-09-25T06:14:08.664Z";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const BANNER_ID = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "banners/login/33333333-3333-4333-8333-333333333333.jpg";
const persistedBanner = {
  id: BANNER_ID,
  imageUrl: "/uploads/banners/login/44444444-4444-4444-8444-444444444444.jpg",
  name: "PIC",
  role: "Kepala",
  unit: "Unit A",
  period: "2026",
  order: 0,
  isActive: true,
  updatedAt: new Date(VERSION),
};

class TestApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const requireAdminMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({
  user: { id: ADMIN_ID, role: "ADMIN" },
}));
const handleApiErrorMock = mock.fn<(...args: any[]) => Response>((error: any) =>
  Response.json(
    { status: error?.status ?? 500, error: true, message: error?.message, data: null },
    { status: error?.status ?? 500 },
  ),
);
const findManyMock = mock.fn<(...args: any[]) => Promise<any[]>>(async () => []);
const findUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(async () => persistedBanner);
const countMock = mock.fn<(...args: any[]) => Promise<number>>(async () => 0);
const aggregateMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({ _max: { order: 2 } }));
const createMock = mock.fn<(...args: any[]) => Promise<any>>(async ({ data }: any) => ({
  ...persistedBanner,
  ...data,
  id: BANNER_ID,
}));
const updateManyMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({ count: 1 }));
const findUniqueOrThrowMock = mock.fn<(...args: any[]) => Promise<any>>(async () => persistedBanner);
const deleteManyMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({ count: 1 }));
const queryRawMock = mock.fn<(...args: any[]) => Promise<any[]>>(async () => []);
const orderStore: Record<string, number> = {};
let bannerRows: { id: string; order: number; updatedAt: Date }[] = [];
const prisma = {
  loginBanner: {
    findMany: findManyMock,
    findUnique: findUniqueMock,
    count: countMock,
    aggregate: aggregateMock,
    create: createMock,
    updateMany: updateManyMock,
    findUniqueOrThrow: findUniqueOrThrowMock,
    deleteMany: deleteManyMock,
  },
};
const tx = {
  ...prisma,
  $queryRaw: queryRawMock,
};
const lifecycle = { __phase: "locked-lifecycle" };
const transactionMock = mock.fn<(...args: any[]) => Promise<any>>(async (
  _client: unknown,
  _plan: unknown,
  callback: (value: unknown) => unknown,
) => {
  const snapshot = { ...orderStore };
  try {
    return await callback(lifecycle);
  } catch (error) {
    for (const key of Object.keys(orderStore)) delete orderStore[key];
    Object.assign(orderStore, snapshot);
    throw error;
  }
});
const contextMock = mock.fn<(...args: any[]) => any>((context: any) => context);
const verifyMock = mock.fn<(...args: any[]) => any>((_descriptor: string, _cleanup: string, context: any) => ({
  context,
}));
const readNewMock = mock.fn<(...args: any[]) => any>((handle: any) => ({
  ...handle.context,
  url: `/uploads/${handle.context.publicId}`,
}));
const findReferencesMock = mock.fn<(...args: any[]) => Promise<any[]>>(async () => []);
const cleanupMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({ kind: "deleted" }));
const rollbackMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({ kind: "deleted" }));
const captureOwnerMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({ __phase: "owner" }));
const captureCleanupMock = mock.fn<(...args: any[]) => any>(() => ({ __phase: "cleanup" }));
const uploadLifecycleError = class UploadLifecycleError extends Error {};
const resolveUploadReferenceMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (url: string) => ({
    kind: "local",
    storageKey: url.slice("/uploads/".length),
    source: "banner-login",
    exists: true,
    isRegularFile: true,
  }),
);

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: TestApiError,
    requireAdmin: requireAdminMock,
    handleApiError: handleApiErrorMock,
  },
});
mock.module("@/lib/prisma", { namedExports: { prisma } });
mock.module("@generated/prisma/client", {
  namedExports: {
    Prisma: {
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        query: strings.join("?"),
        values,
      }),
    },
  },
});
mock.module("@/lib/api/upload-storage", {
  namedExports: {
    classifyStorageKey: (key: string) =>
      key.startsWith("banners/login/") ? "banner-login" : null,
    resolveUploadReference: resolveUploadReferenceMock,
  },
});
mock.module("@/lib/api/upload-lifecycle", {
  namedExports: {
    UploadLifecycleError: uploadLifecycleError,
    createServerOwnedUploadContext: contextMock,
    verifyNewUpload: verifyMock,
    readVerifiedNewUpload: readNewMock,
    findUploadReferences: findReferencesMock,
    withUploadLifecycleTransaction: transactionMock,
    getUploadLifecycleTransaction: () => tx,
    rollbackVerifiedNewUpload: rollbackMock,
    cleanupPersistedOldUploadAfterCommit: cleanupMock,
    captureLoginBannerOwner: captureOwnerMock,
    capturePersistedOldCleanup: captureCleanupMock,
    readPersistedOldCleanup: () => ({ fileKey: persistedBanner.imageUrl.slice("/uploads/".length) }),
    parseExpectedUpdatedAt: (value: string) => {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
        throw new uploadLifecycleError("bad timestamp");
      }
      return date;
    },
    matchesExpectedUpdatedAt: (value: string, actual: Date) =>
      new Date(value).getTime() === actual.getTime(),
  },
});

let GET: (request: Request) => Promise<Response>;
let POST: (request: Request) => Promise<Response>;
let PATCH: (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;
let DELETE: (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;
let REORDER: (request: NextRequest) => Promise<Response>;

before(async () => {
  ({ GET, POST } = await import("./route"));
  ({ PATCH, DELETE } = await import("./[id]/route"));
  ({ POST: REORDER } = await import("./reorder/route"));
});

beforeEach(() => {
  for (const fn of [
    requireAdminMock,
    handleApiErrorMock,
    findManyMock,
    findUniqueMock,
    countMock,
    aggregateMock,
    createMock,
    updateManyMock,
    findUniqueOrThrowMock,
    deleteManyMock,
    queryRawMock,
    transactionMock,
    contextMock,
    verifyMock,
    readNewMock,
    findReferencesMock,
    cleanupMock,
    rollbackMock,
    captureOwnerMock,
    captureCleanupMock,
    resolveUploadReferenceMock,
  ]) {
    fn.mock.resetCalls();
  }
  requireAdminMock.mock.mockImplementation(async () => ({
    user: { id: ADMIN_ID, role: "ADMIN" },
  }));
  findManyMock.mock.mockImplementation(async () => []);
  findUniqueMock.mock.mockImplementation(async () => persistedBanner as any);
  countMock.mock.mockImplementation(async () => 0);
  updateManyMock.mock.mockImplementation(async (args: any) => {
    if (args?.data?.order !== undefined && args?.where?.id) {
      orderStore[args.where.id] = args.data.order;
    }
    return { count: 1 };
  });
  for (const key of Object.keys(orderStore)) delete orderStore[key];
  bannerRows = [{ id: BANNER_ID, order: 0, updatedAt: new Date(VERSION) }];
  transactionMock.mock.mockImplementation(async (
    _client: unknown,
    _plan: unknown,
    callback: (value: unknown) => unknown,
  ) => {
    const snapshot = { ...orderStore };
    try {
      return await callback(lifecycle);
    } catch (error) {
      for (const key of Object.keys(orderStore)) delete orderStore[key];
      Object.assign(orderStore, snapshot);
      throw error;
    }
  });
  findReferencesMock.mock.mockImplementation(async () => []);
  queryRawMock.mock.mockImplementation(async (sql: any) => {
    const query = String(sql?.query);
    if (query.includes('"updatedAt"')) {
      const skip = Number(sql?.values?.[1] ?? 0);
      return bannerRows.slice(skip, skip + 100);
    }
    return [];
  });
  resolveUploadReferenceMock.mock.mockImplementation(async (url: string) => ({
    kind: "local",
    storageKey: url.slice("/uploads/".length),
    source: "banner-login",
    exists: true,
    isRegularFile: true,
  }));
});

const request = (url: string, body?: unknown) =>
  new NextRequest(url, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const adminRequest = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const replacementReceipt = {
  imageUrl: "https://attacker.example/not-the-upload.jpg",
  bannerState: "REPLACED",
  publicId: FILE_ID,
  descriptor: "signed-descriptor",
  cleanupToken: "signed-cleanup",
  name: "PIC",
  role: "Kepala",
  unit: "Unit A",
  period: "2026",
  order: 0,
};

describe("LoginBanner upload lifecycle routes", () => {
  it("keeps public GET as an active array and returns stable bounded admin pages", async () => {
    await GET(request("http://localhost/api/banners"));
    assert.deepEqual(findManyMock.mock.calls[0]?.arguments[0], {
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      take: 20,
    });

    const pageRows = [
      { ...persistedBanner, id: BANNER_ID, order: 100 },
      { ...persistedBanner, id: ADMIN_ID, order: 101 },
    ];
    findManyMock.mock.mockImplementationOnce(async () => pageRows);
    countMock.mock.mockImplementation(async (args: any) =>
      args?.where?.isActive === true ? 183 : 250,
    );
    const response = await GET(
      request("http://localhost/api/banners?all=true&page=2&pageSize=100"),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(findManyMock.mock.calls[1]?.arguments[0], {
      where: {},
      orderBy: [{ order: "asc" }, { id: "asc" }],
      skip: 100,
      take: 100,
    });
    assert.deepEqual((await response.json()).data, {
      items: pageRows.map((row) => ({ ...row, updatedAt: VERSION })),
      total: 250,
      activeCount: 183,
      page: 2,
      pageSize: 100,
      totalPages: 3,
    });
    assert.equal(countMock.mock.callCount(), 2);
  });

  it("requires Admin and rejects out-of-bound page sizes before protected queries", async () => {
    requireAdminMock.mock.mockImplementationOnce(async () => {
      throw new TestApiError("forbidden", 403);
    });
    const forbidden = await GET(request("http://localhost/api/banners?all=true&page=1&pageSize=100"));
    assert.equal(forbidden.status, 403);
    assert.equal(findManyMock.mock.callCount(), 0);
    assert.equal(countMock.mock.callCount(), 0);

    const invalid = await GET(
      request("http://localhost/api/banners?all=true&page=1&pageSize=101"),
    );
    assert.equal(invalid.status, 400);
    assert.equal(findManyMock.mock.callCount(), 0);
    assert.equal(countMock.mock.callCount(), 0);
  });

  it("returns an empty bounded page beyond the last page", async () => {
    countMock.mock.mockImplementation(async (args: any) =>
      args?.where?.isActive === true ? 183 : 250,
    );
    const response = await GET(
      request("http://localhost/api/banners?all=true&page=4&pageSize=100"),
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.data, {
      items: [],
      total: 250,
      activeCount: 183,
      page: 4,
      pageSize: 100,
      totalPages: 3,
    });
    assert.equal(findManyMock.mock.callCount(), 0);
  });

  it("accepts a complete REPLACED receipt on create and persists only its canonical URL", async () => {
    const response = await POST(
      adminRequest("http://localhost/api/banners", "POST", replacementReceipt),
    );
    assert.equal(response.status, 201);
    assert.deepEqual(contextMock.mock.calls[0]?.arguments[0], {
      userId: ADMIN_ID,
      purpose: "LOGIN_BANNER",
      mode: "CREATE",
      publicId: FILE_ID,
    });
    assert.equal(createMock.mock.calls[0]?.arguments[0].data.imageUrl, `/uploads/${FILE_ID}`);
    assert.equal(createMock.mock.calls[0]?.arguments[0].data.order, 3);
    assert.equal(rollbackMock.mock.callCount(), 0);
  });

  it("rejects an incomplete create receipt before persistence", async () => {
    const response = await POST(
      adminRequest("http://localhost/api/banners", "POST", {
        ...replacementReceipt,
        cleanupToken: undefined,
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(createMock.mock.callCount(), 0);
    assert.equal(verifyMock.mock.callCount(), 0);
  });

  it("rejects a wrong or unpaired signed receipt and rolls back a verified file on later validation failure", async () => {
    verifyMock.mock.mockImplementationOnce(() => {
      throw new uploadLifecycleError("tampered");
    });
    const wrongReceipt = await POST(
      adminRequest("http://localhost/api/banners", "POST", replacementReceipt),
    );
    assert.equal(wrongReceipt.status, 400);
    assert.equal(createMock.mock.callCount(), 0);

    const invalidFields = await POST(
      adminRequest("http://localhost/api/banners", "POST", {
        ...replacementReceipt,
        name: "x",
      }),
    );
    assert.equal(invalidFields.status, 400);
    assert.equal(rollbackMock.mock.callCount(), 1);
    assert.equal(createMock.mock.callCount(), 0);
  });

  it("rejects a replacement file already referenced anywhere and rolls back its receipt", async () => {
    findReferencesMock.mock.mockImplementationOnce(async () => [
      { owner: { kind: "ProgramBudaya", id: BANNER_ID } },
    ] as any);
    const response = await POST(
      adminRequest("http://localhost/api/banners", "POST", replacementReceipt),
    );
    assert.equal(response.status, 409);
    assert.equal(createMock.mock.callCount(), 0);
    assert.equal(rollbackMock.mock.callCount(), 1);
  });

  it("rechecks the managed file under lock and rolls back when cleanup wins first", async () => {
    resolveUploadReferenceMock.mock.mockImplementationOnce(async (url: string) => ({
      kind: "local",
      storageKey: url.slice("/uploads/".length),
      source: "banner-login",
      exists: true,
      isRegularFile: true,
    }));
    resolveUploadReferenceMock.mock.mockImplementationOnce(async () => ({
      kind: "missing",
      storageKey: FILE_ID,
      source: "banner-login",
    }));
    const created = await POST(
      adminRequest("http://localhost/api/banners", "POST", replacementReceipt),
    );
    assert.equal(created.status, 400);
    assert.equal(createMock.mock.callCount(), 0);
    assert.equal(findReferencesMock.mock.callCount(), 0);
    assert.equal(rollbackMock.mock.callCount(), 1);

    resolveUploadReferenceMock.mock.mockImplementationOnce(async (url: string) => ({
      kind: "local",
      storageKey: url.slice("/uploads/".length),
      source: "banner-login",
      exists: true,
      isRegularFile: true,
    }));
    resolveUploadReferenceMock.mock.mockImplementationOnce(async () => ({
      kind: "missing",
      storageKey: FILE_ID,
      source: "banner-login",
    }));
    const replaced = await PATCH(
      adminRequest("http://localhost/api/banners", "PATCH", {
        ...replacementReceipt,
        expectedUpdatedAt: VERSION,
      }),
      { params: Promise.resolve({ id: BANNER_ID }) },
    );
    assert.equal(replaced.status, 400);
    assert.equal(updateManyMock.mock.callCount(), 0);
    assert.equal(rollbackMock.mock.callCount(), 2);
  });

  it("rolls back a verified new file when the database transaction fails", async () => {
    transactionMock.mock.mockImplementationOnce(async () => {
      throw new Error("database write failed");
    });
    const response = await POST(
      adminRequest("http://localhost/api/banners", "POST", replacementReceipt),
    );
    assert.equal(response.status, 500);
    assert.equal(rollbackMock.mock.callCount(), 1);
    assert.equal(createMock.mock.callCount(), 0);
  });

  it("requires Admin before upload or database work on create", async () => {
    requireAdminMock.mock.mockImplementationOnce(async () => {
      throw new TestApiError("forbidden", 403);
    });
    const response = await POST(
      adminRequest("http://localhost/api/banners", "POST", replacementReceipt),
    );
    assert.equal(response.status, 403);
    assert.equal(verifyMock.mock.callCount(), 0);
    assert.equal(transactionMock.mock.callCount(), 0);
  });

  it("requires Admin before replacement receipt verification", async () => {
    requireAdminMock.mock.mockImplementationOnce(async () => {
      throw new TestApiError("forbidden", 403);
    });
    const response = await PATCH(
      adminRequest("http://localhost/api/banners", "PATCH", {
        ...replacementReceipt,
        expectedUpdatedAt: VERSION,
      }),
      { params: Promise.resolve({ id: BANNER_ID }) },
    );
    assert.equal(response.status, 403);
    assert.equal(verifyMock.mock.callCount(), 0);
    assert.equal(findUniqueMock.mock.callCount(), 0);
  });

  it("preserves locked DB media for an unchanged edit and uses the expected version", async () => {
    const response = await PATCH(
      adminRequest("http://localhost/api/banners", "PATCH", {
        imageUrl: "https://attacker.example/replacement.jpg",
        bannerState: "UNCHANGED",
        expectedUpdatedAt: VERSION,
        name: "Updated name",
      }),
      { params: Promise.resolve({ id: BANNER_ID }) },
    );
    assert.equal(response.status, 200);
    assert.equal(
      updateManyMock.mock.calls[0]?.arguments[0].data.imageUrl,
      undefined,
    );
    assert.equal(
      Object.hasOwn(updateManyMock.mock.calls[0]?.arguments[0].data ?? {}, "bannerState"),
      false,
    );
    assert.deepEqual(updateManyMock.mock.calls[0]?.arguments[0].where, {
      id: BANNER_ID,
      updatedAt: new Date(VERSION),
    });
  });

  it("cleans replaced managed files after commit and preserves external or legacy media", async () => {
    const replaced = await PATCH(
      adminRequest("http://localhost/api/banners", "PATCH", {
        ...replacementReceipt,
        expectedUpdatedAt: VERSION,
      }),
      { params: Promise.resolve({ id: BANNER_ID }) },
    );
    assert.equal(replaced.status, 200);
    assert.equal(
      Object.hasOwn(updateManyMock.mock.calls[0]?.arguments[0].data ?? {}, "bannerState"),
      false,
    );
    assert.equal(
      updateManyMock.mock.calls[0]?.arguments[0].data.imageUrl,
      `/uploads/${FILE_ID}`,
    );
    assert.deepEqual(contextMock.mock.calls[0]?.arguments[0], {
      userId: ADMIN_ID,
      purpose: "LOGIN_BANNER",
      mode: "REPLACEMENT",
      publicId: FILE_ID,
    });
    assert.equal(captureOwnerMock.mock.callCount(), 1);
    assert.equal(cleanupMock.mock.callCount(), 1);

    for (const imageUrl of [
      "https://cdn.example/banner.jpg",
      "/uploads/legacy-banner.jpg",
    ]) {
      captureOwnerMock.mock.resetCalls();
      cleanupMock.mock.resetCalls();
      findUniqueMock.mock.mockImplementation(async () => ({
        ...persistedBanner,
        imageUrl,
      }));
      const response = await PATCH(
        adminRequest("http://localhost/api/banners", "PATCH", {
          ...replacementReceipt,
          expectedUpdatedAt: VERSION,
        }),
        { params: Promise.resolve({ id: BANNER_ID }) },
      );
      assert.equal(response.status, 200);
      assert.equal(captureOwnerMock.mock.callCount(), 0);
      assert.equal(cleanupMock.mock.callCount(), 0);
    }
  });

  it("rejects incomplete receipts and rolls back a verified upload after a stale version", async () => {
    const incomplete = await PATCH(
      adminRequest("http://localhost/api/banners", "PATCH", {
        bannerState: "REPLACED",
        publicId: FILE_ID,
        descriptor: "signed-descriptor",
        expectedUpdatedAt: VERSION,
      }),
      { params: Promise.resolve({ id: BANNER_ID }) },
    );
    assert.equal(incomplete.status, 400);
    assert.equal(verifyMock.mock.callCount(), 0);

    findUniqueMock.mock.mockImplementationOnce(async () => ({
      ...persistedBanner,
      updatedAt: new Date("2026-09-25T06:14:09.000Z"),
    }));
    const stale = await PATCH(
      adminRequest("http://localhost/api/banners", "PATCH", {
        ...replacementReceipt,
        expectedUpdatedAt: VERSION,
      }),
      { params: Promise.resolve({ id: BANNER_ID }) },
    );
    assert.equal(stale.status, 409);
    assert.equal(transactionMock.mock.callCount(), 0);
    assert.equal(verifyMock.mock.callCount(), 1);
    assert.equal(rollbackMock.mock.callCount(), 1);
  });

  it("moves across a page boundary and normalizes only changed rows", async () => {
    const neighborId = "22222222-2222-4222-8222-222222222223";
    bannerRows = Array.from({ length: 101 }, (_, index) => ({
      id: index === 99 ? BANNER_ID : index === 100 ? neighborId : `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
      order: index < 100 ? index : 110,
      updatedAt: new Date(VERSION),
    }));
    bannerRows[100].order = 100;
    bannerRows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const targetIndex = bannerRows.findIndex((row) => row.id === BANNER_ID);
    assert.equal(targetIndex, 99);
    const response = await REORDER(
      adminRequest("http://localhost/api/banners/reorder", "POST", {
        id: BANNER_ID,
        direction: "down",
        expectedUpdatedAt: VERSION,
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(queryRawMock.mock.callCount(), 2);
    assert.match(queryRawMock.mock.calls[0]?.arguments[0].query, /ORDER BY "order" ASC, "id" ASC/);
    assert.match(queryRawMock.mock.calls[0]?.arguments[0].query, /LIMIT \? OFFSET \? FOR UPDATE/);
    assert.deepEqual(
      updateManyMock.mock.calls.map((call) => ({
        id: call.arguments[0].where.id,
        order: call.arguments[0].data.order,
      })),
      [
        { id: neighborId, order: 99 },
        { id: BANNER_ID, order: 100 },
      ],
    );
  });

  it("moves adjacent legacy rows with equal order values and advances changed versions", async () => {
    const neighborId = "22222222-2222-4222-8222-222222222221";
    bannerRows = [
      { id: neighborId, order: 0, updatedAt: new Date(VERSION) },
      { id: BANNER_ID, order: 0, updatedAt: new Date(VERSION) },
    ];
    const response = await REORDER(
      adminRequest("http://localhost/api/banners/reorder", "POST", {
        id: BANNER_ID,
        direction: "up",
        expectedUpdatedAt: VERSION,
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(
      updateManyMock.mock.calls.map((call) => ({
        id: call.arguments[0].where.id,
        order: call.arguments[0].data.order,
      })),
      [{ id: BANNER_ID, order: 0 }, { id: neighborId, order: 1 }],
    );
    for (const call of updateManyMock.mock.calls) {
      assert.ok(call.arguments[0].data.updatedAt > new Date(VERSION));
    }
  });

  it("rejects stale CAS and treats first/last positions as a successful no-op", async () => {
    bannerRows = [{ id: BANNER_ID, order: 0, updatedAt: new Date("2026-09-25T06:14:09.000Z") }];
    const stale = await REORDER(
      adminRequest("http://localhost/api/banners/reorder", "POST", {
        id: BANNER_ID,
        direction: "down",
        expectedUpdatedAt: VERSION,
      }),
    );
    assert.equal(stale.status, 409);
    assert.equal(updateManyMock.mock.callCount(), 0);

    bannerRows = [{ id: BANNER_ID, order: 0, updatedAt: new Date(VERSION) }];
    const boundary = await REORDER(
      adminRequest("http://localhost/api/banners/reorder", "POST", {
        id: BANNER_ID,
        direction: "up",
        expectedUpdatedAt: VERSION,
      }),
    );
    assert.equal(boundary.status, 200);
    assert.equal(updateManyMock.mock.callCount(), 0);
    assert.match((await boundary.json()).message, /batas urutan/i);
  });

  it("rolls back a partial normalization if a row CAS loses", async () => {
    const neighborId = "22222222-2222-4222-8222-222222222223";
    const before = { [BANNER_ID]: 99, [neighborId]: 100 };
    Object.assign(orderStore, before);
    bannerRows = [
      { id: BANNER_ID, order: 99, updatedAt: new Date(VERSION) },
      { id: neighborId, order: 100, updatedAt: new Date(VERSION) },
    ];
    updateManyMock.mock.mockImplementationOnce(async (args: any) => {
      orderStore[args.where.id] = args.data.order;
      return { count: 1 };
    });
    updateManyMock.mock.mockImplementationOnce(async () => ({ count: 0 }));

    const response = await REORDER(
      adminRequest("http://localhost/api/banners/reorder", "POST", {
        id: BANNER_ID,
        direction: "down",
        expectedUpdatedAt: VERSION,
      }),
    );
    assert.equal(response.status, 409);
    assert.deepEqual(orderStore, before);
  });

  it("rejects stale deletion without deleting the banner", async () => {
    const response = await DELETE(
      adminRequest("http://localhost/api/banners", "DELETE", {
        expectedUpdatedAt: "2026-09-24T00:00:00.000Z",
      }),
      { params: Promise.resolve({ id: BANNER_ID }) },
    );
    assert.equal(response.status, 409);
    assert.equal(deleteManyMock.mock.callCount(), 0);
  });

  it("deletes and cleans only exact managed files after commit", async () => {
    const response = await DELETE(
      adminRequest("http://localhost/api/banners", "DELETE", {
        expectedUpdatedAt: VERSION,
      }),
      { params: Promise.resolve({ id: BANNER_ID }) },
    );
    assert.equal(response.status, 200);
    assert.equal(deleteManyMock.mock.callCount(), 1);
    assert.equal(cleanupMock.mock.callCount(), 1);

    for (const imageUrl of [
      "https://cdn.example/banner.jpg",
      "/uploads/legacy-banner.jpg",
    ]) {
      captureOwnerMock.mock.resetCalls();
      cleanupMock.mock.resetCalls();
      findUniqueMock.mock.mockImplementation(async () => ({
        ...persistedBanner,
        imageUrl,
      }));
      const legacyOrExternal = await DELETE(
        adminRequest("http://localhost/api/banners", "DELETE", {
          expectedUpdatedAt: VERSION,
        }),
        { params: Promise.resolve({ id: BANNER_ID }) },
      );
      assert.equal(legacyOrExternal.status, 200);
      assert.equal(captureOwnerMock.mock.callCount(), 0);
      assert.equal(cleanupMock.mock.callCount(), 0);
    }
  });

  it("keeps successful PATCH and DELETE responses inspectable when postcommit cleanup fails or rejects", async () => {
    const originalConsoleError = console.error;
    const logs: unknown[][] = [];
    console.error = (...args: unknown[]) => logs.push(args);
    try {
      cleanupMock.mock.mockImplementationOnce(async () => ({
        kind: "failed",
        fileKey: persistedBanner.imageUrl.slice("/uploads/".length),
      }));
      const patchFailedOutcome = await PATCH(
        adminRequest("http://localhost/api/banners", "PATCH", {
          ...replacementReceipt,
          expectedUpdatedAt: VERSION,
        }),
        { params: Promise.resolve({ id: BANNER_ID }) },
      );
      assert.equal(patchFailedOutcome.status, 200);
      assert.deepEqual(logs[0]?.[1], {
        kind: "failed",
        fileKey: persistedBanner.imageUrl.slice("/uploads/".length),
      });

      cleanupMock.mock.mockImplementationOnce(async () => {
        throw new Error("cleanup transaction rejected");
      });
      const patchRejected = await PATCH(
        adminRequest("http://localhost/api/banners", "PATCH", {
          ...replacementReceipt,
          expectedUpdatedAt: VERSION,
        }),
        { params: Promise.resolve({ id: BANNER_ID }) },
      );
      assert.equal(patchRejected.status, 200);
      assert.equal((logs[1]?.[1] as any)?.kind, "failed");
      assert.equal(
        (logs[1]?.[1] as any)?.fileKey,
        persistedBanner.imageUrl.slice("/uploads/".length),
      );
      assert.equal(
        (logs[1]?.[1] as any)?.error.message,
        "cleanup transaction rejected",
      );

      cleanupMock.mock.mockImplementationOnce(async () => ({
        kind: "failed",
        fileKey: persistedBanner.imageUrl.slice("/uploads/".length),
      }));
      const deleteFailedOutcome = await DELETE(
        adminRequest("http://localhost/api/banners", "DELETE", {
          expectedUpdatedAt: VERSION,
        }),
        { params: Promise.resolve({ id: BANNER_ID }) },
      );
      assert.equal(deleteFailedOutcome.status, 200);
      assert.deepEqual(logs[2]?.[1], {
        kind: "failed",
        fileKey: persistedBanner.imageUrl.slice("/uploads/".length),
      });

      cleanupMock.mock.mockImplementationOnce(async () => {
        throw new Error("cleanup transaction rejected");
      });
      const deleteRejected = await DELETE(
        adminRequest("http://localhost/api/banners", "DELETE", {
          expectedUpdatedAt: VERSION,
        }),
        { params: Promise.resolve({ id: BANNER_ID }) },
      );
      assert.equal(deleteRejected.status, 200);
      assert.equal((logs[3]?.[1] as any)?.kind, "failed");
      assert.equal(
        (logs[3]?.[1] as any)?.fileKey,
        persistedBanner.imageUrl.slice("/uploads/".length),
      );
    } finally {
      console.error = originalConsoleError;
    }
  });
});
