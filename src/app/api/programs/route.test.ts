import { NextRequest } from "next/server";
import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";

type ProgramRecord = {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  frequency: number;
  tw: number | null;
  startDate: Date;
  endDate: Date;
  uploadDeadline: Date;
  categoryId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const directCategory = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "TOGA",
  targetUnit: "PARTISIPASI_PERSEN",
  evidenceMode: "PHOTO_WITHOUT_AI",
  scoreInputMode: "DIRECT_ADMIN",
};
const excelCategory = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Partisipasi Excel",
  targetUnit: "PARTISIPASI_PERSEN",
  evidenceMode: "NONE",
  scoreInputMode: "EXCEL_IMPORT",
};
const invalidCategory = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Kategori invalid",
  targetUnit: "KEGIATAN",
  evidenceMode: "NONE",
  scoreInputMode: "DIRECT_ADMIN",
};

const authMock = mock.fn(async () => ({
  user: { id: "admin-1", role: "ADMIN", authProvider: "LOCAL" },
}));
const persistedAdminMock = mock.fn(async () => ({
  id: "admin-1",
  name: "Admin",
  username: "admin",
  role: "ADMIN",
  authProvider: "LOCAL",
  isActive: true,
  unitId: null,
  unit: null,
  employee: null,
}));
const programFindManyMock = mock.fn<(...args: any[]) => Promise<any[]>>(
  async () => [],
);
const programCountMock = mock.fn<(...args: any[]) => Promise<number>>(
  async () => 0,
);
const categoryCountMock = mock.fn<(...args: any[]) => Promise<number>>(
  async () => 1,
);
const activityCountMock = mock.fn<(...args: any[]) => Promise<number>>(
  async () => 0,
);
const programs: ProgramRecord[] = [];
const advisoryKeys: string[] = [];
let transactionTail = Promise.resolve();

function categoryFor(id: string | null) {
  if (id === directCategory.id) return directCategory;
  if (id === excelCategory.id) return excelCategory;
  if (id === invalidCategory.id) return invalidCategory;
  return null;
}

function matchesDirectIdentity(
  program: ProgramRecord,
  where: {
    id?: { not?: string };
    categoryId?: string;
    tw?: number;
    startDate?: { gte?: Date; lte?: Date };
  },
) {
  if (where.id?.not && program.id === where.id.not) return false;
  if (where.categoryId && program.categoryId !== where.categoryId) return false;
  if (where.tw !== undefined && program.tw !== where.tw) return false;
  if (where.startDate?.gte && program.startDate < where.startDate.gte) {
    return false;
  }
  if (where.startDate?.lte && program.startDate > where.startDate.lte) {
    return false;
  }
  return true;
}

const tx = {
  programCategory: {
    findUnique: mock.fn(async ({ where }: { where: { id: string } }) =>
      categoryFor(where.id),
    ),
  },
  programBudaya: {
    findUnique: mock.fn(async ({ where }: { where: { id: string } }) =>
      programs.find((program) => program.id === where.id) ?? null,
    ),
    findFirst: mock.fn(
      async ({
        where,
      }: {
        where: Parameters<typeof matchesDirectIdentity>[1];
      }) => {
        const duplicate = programs.find((program) =>
          matchesDirectIdentity(program, where),
        );
        return duplicate ? { id: duplicate.id } : null;
      },
    ),
    create: mock.fn(
      async ({
        data,
      }: {
        data: Omit<ProgramRecord, "id" | "createdAt" | "updatedAt">;
      }) => {
        const now = new Date("2026-08-30T00:00:00.000Z");
        const program = {
          ...data,
          id: `program-${programs.length + 1}`,
          createdAt: now,
          updatedAt: now,
        } satisfies ProgramRecord;
        programs.push(program);
        return { ...program, category: categoryFor(program.categoryId) };
      },
    ),
    update: mock.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ProgramRecord>;
      }) => {
        const program = programs.find((item) => item.id === where.id);
        assert.ok(program);
        Object.assign(program, data);
        return { ...program, category: categoryFor(program.categoryId) };
      },
    ),
    updateMany: mock.fn(async ({
      where, data,
    }: {
      where: { id: string; updatedAt?: Date };
      data: Partial<ProgramRecord>;
    }) => {
      const program = programs.find((item) => item.id === where.id);
      if (!program || (where.updatedAt && program.updatedAt.getTime() !== where.updatedAt.getTime())) {
        return { count: 0 };
      }
      Object.assign(program, data);
      return { count: 1 };
    }),
  },
  activityReport: { count: activityCountMock },
  $queryRaw: mock.fn(async (query: { values: unknown[] }) => {
    advisoryKeys.push(String(query.values[0]));
    return [];
  }),
};

const transactionMock = mock.fn(
  async (callback: (transaction: typeof tx) => Promise<unknown>) => {
    let release!: () => void;
    const previous = transactionTail;
    transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback(tx);
    } finally {
      release();
    }
  },
);

const lifecycleMock = mock.fn(
  async (_client: unknown, plan: unknown, callback: (lifecycle: unknown) => Promise<unknown>) =>
    transactionMock(() => callback({ plan })),
);
const findUploadReferencesMock = mock.fn(async () => [] as unknown[]);
const captureProgramOwnerMock = mock.fn(async () => ({}));
const captureOldCleanupMock = mock.fn(() => ({}));
const cleanupOldUploadMock = mock.fn(async () => ({ kind: "deleted" }));
const verifyNewUploadMock = mock.fn((descriptor: string, cleanupToken: string, context: any) => ({
  publicId: context.publicId,
  url: `/uploads/${context.publicId}`,
  descriptor,
  cleanupToken,
}));
const rollbackUploadMock = mock.fn(async () => ({ kind: "deleted" }));

const programFindUniqueMock = mock.fn(
  async ({ where }: { where: { id: string } }) =>
    programs.find((program) => program.id === where.id) ?? null,
);

mock.module("@/auth", {
  namedExports: { auth: authMock },
});

mock.module("@generated/prisma", {
  namedExports: {
    Prisma: {
      TransactionIsolationLevel: { Serializable: "Serializable" },
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
      }),
    },
  },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: { findUnique: persistedAdminMock },
      programBudaya: {
        findMany: programFindManyMock,
        count: programCountMock,
        findUnique: programFindUniqueMock,
      },
      programCategory: { count: categoryCountMock },
      activityReport: { count: activityCountMock },
      $transaction: transactionMock,
    },
  },
});

mock.module("@/lib/api/upload-lifecycle", {
  namedExports: {
    createServerOwnedUploadContext: (context: unknown) => context,
    verifyNewUpload: verifyNewUploadMock,
    readVerifiedNewUpload: (upload: any) => upload,
    rollbackVerifiedNewUpload: rollbackUploadMock,
    UploadLifecycleError: class UploadLifecycleError extends Error {},
    withUploadLifecycleTransaction: lifecycleMock,
    getUploadLifecycleTransaction: () => tx,
    findUploadReferences: findUploadReferencesMock,
    parseExpectedUpdatedAt: (value: string) => new Date(value),
    matchesExpectedUpdatedAt: (value: string, actual: Date) =>
      new Date(value).getTime() === actual.getTime(),
    captureProgramBudayaOwner: captureProgramOwnerMock,
    capturePersistedOldCleanup: captureOldCleanupMock,
    cleanupPersistedOldUploadAfterCommit: cleanupOldUploadMock,
  },
});

mock.module("@/lib/api/upload-storage", {
  namedExports: {
    resolveUploadReference: async (url: string) => ({
      kind: "local", exists: true, isRegularFile: true,
      storageKey: url.slice("/uploads/".length),
    }),
    classifyUploadReference: (value: string) =>
      value.startsWith("/uploads/")
        ? { kind: "local", storageKey: value.slice("/uploads/".length) }
        : { kind: "external-http", url: value },
    classifyManagedStorageKey: (key: string) =>
      key.startsWith("banners/programs/") ? "banner-programs" : null,
  },
});

let GET: (req: Request) => Promise<Response>;
let POST: (req: Request) => Promise<Response>;
let PUT: (
  req: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;
let PATCH: (
  req: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

before(async () => {
  ({ GET, POST } = await import("./route"));
  ({ PUT, PATCH } = await import("./[id]/route"));
});

beforeEach(() => {
  programs.splice(0);
  advisoryKeys.splice(0);
  transactionTail = Promise.resolve();
  authMock.mock.resetCalls();
  persistedAdminMock.mock.resetCalls();
  programFindManyMock.mock.resetCalls();
  programCountMock.mock.resetCalls();
  categoryCountMock.mock.resetCalls();
  activityCountMock.mock.resetCalls();
  programFindUniqueMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
  tx.programCategory.findUnique.mock.resetCalls();
  tx.programBudaya.findUnique.mock.resetCalls();
  tx.programBudaya.findFirst.mock.resetCalls();
  tx.programBudaya.create.mock.resetCalls();
  tx.programBudaya.update.mock.resetCalls();
  tx.programBudaya.updateMany.mock.resetCalls();
  tx.$queryRaw.mock.resetCalls();
  lifecycleMock.mock.resetCalls();
  findUploadReferencesMock.mock.resetCalls();
  captureProgramOwnerMock.mock.resetCalls();
  captureOldCleanupMock.mock.resetCalls();
  cleanupOldUploadMock.mock.resetCalls();
  verifyNewUploadMock.mock.resetCalls();
  rollbackUploadMock.mock.resetCalls();
});

function programPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Program TOGA TW 1",
    description: "Program bukti TOGA",
    bannerUrl: null,
    frequency: 9,
    tw: 1,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-03-31T23:59:59.999Z",
    uploadDeadline: "2026-04-10T23:59:59.999Z",
    categoryId: directCategory.id,
    ...overrides,
  };
}

function writeRequest(url: string, method: "POST" | "PUT" | "PATCH", body: unknown) {
  const data = { ...(body as Record<string, unknown>) };
  if (method === "POST") data.bannerState ??= "NONE";
  if (method === "PUT") {
    const id = new URL(url).pathname.split("/").pop();
    const existing = programs.find((program) => program.id === id);
    data.expectedUpdatedAt ??= existing?.updatedAt.toISOString();
    data.bannerState ??= existing?.bannerUrl ? "UNCHANGED" : "NONE";
  }
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function responseBody(response: Response) {
  return response.json() as Promise<{
    status: number;
    error: boolean;
    message: string;
    data: any;
    errors?: any;
  }>;
}

function existingProgram(id: string, name: string): ProgramRecord {
  return {
    id,
    name,
    description: null,
    bannerUrl: null,
    frequency: 4,
    tw: 4,
    startDate: new Date("2026-10-01T00:00:00.000Z"),
    endDate: new Date("2026-12-20T23:59:59.999Z"),
    uploadDeadline: new Date("2026-12-31T23:59:59.999Z"),
    categoryId: null,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

test("GET combines purpose and targetUnit in one category relation predicate", async () => {
  const response = await GET(
    new NextRequest(
      "http://localhost/api/programs?purpose=EVIDENCE&targetUnit=PARTISIPASI_PERSEN",
    ),
  );
  const body = await responseBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.error, false);
  assert.equal(programFindManyMock.mock.callCount(), 1);
  const args = programFindManyMock.mock.calls[0].arguments[0] as {
    where: Record<string, unknown>;
    skip: number;
    take: number;
  };
  assert.deepEqual(args.where, {
    category: {
      evidenceMode: { not: "NONE" },
      targetUnit: "PARTISIPASI_PERSEN",
    },
  });
  assert.equal(args.skip, 0);
  assert.equal(args.take, 10);
});

test("GET preserves omitted and ALL semantics for purpose and targetUnit", async () => {
  const responses = await Promise.all([
    GET(new NextRequest("http://localhost/api/programs")),
    GET(
      new NextRequest(
        "http://localhost/api/programs?purpose=ALL&targetUnit=ALL",
      ),
    ),
    GET(new NextRequest("http://localhost/api/programs?purpose=EVIDENCE")),
    GET(new NextRequest("http://localhost/api/programs?targetUnit=KEGIATAN")),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200, 200, 200],
  );
  const whereClauses = programFindManyMock.mock.calls.map(
    (call) => (call.arguments[0] as { where: Record<string, unknown> }).where,
  );
  assert.deepEqual(whereClauses, [
    {},
    {},
    { category: { evidenceMode: { not: "NONE" } } },
    { category: { targetUnit: "KEGIATAN" } },
  ]);
});

test("parallel direct-admin creates normalize frequency and return one 201 plus one 409", async () => {
  const responses = await Promise.all([
    POST(
      writeRequest("http://localhost/api/programs", "POST", programPayload()),
    ),
    POST(
      writeRequest(
        "http://localhost/api/programs",
        "POST",
        programPayload({ name: "Program TOGA Duplikat" }),
      ),
    ),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 409],
  );
  assert.equal(programs.length, 1);
  assert.equal(programs[0].frequency, 1);
  assert.deepEqual(advisoryKeys, [
    `direct-program:${directCategory.id}:2026:1`,
    `direct-program:${directCategory.id}:2026:1`,
  ]);
});

test("create accepts the approved Excel tuple and rejects an incomplete tuple", async () => {
  const accepted = await POST(
    writeRequest(
      "http://localhost/api/programs",
      "POST",
      programPayload({
        categoryId: excelCategory.id,
        frequency: 4,
        tw: 1,
      }),
    ),
  );
  assert.equal(accepted.status, 201);
  assert.equal(programs[0].frequency, 4);

  const rejected = await POST(
    writeRequest(
      "http://localhost/api/programs",
      "POST",
      programPayload({
        categoryId: invalidCategory.id,
      }),
    ),
  );
  assert.equal(rejected.status, 422);
  assert.equal(programs.length, 1);
});

test("POST ignores a client banner URL without a replacement receipt", async () => {
  const response = await POST(writeRequest(
    "http://localhost/api/programs", "POST",
    programPayload({ bannerUrl: "https://attacker.invalid/banner.jpg" }),
  ));

  assert.equal(response.status, 201);
  assert.equal(programs[0].bannerUrl, null);
  assert.equal(verifyNewUploadMock.mock.callCount(), 0);
});

test("POST persists only the canonical URL from a verified program-banner receipt", async () => {
  const publicId = "banners/programs/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg";
  const response = await POST(writeRequest(
    "http://localhost/api/programs", "POST",
    programPayload({
      bannerState: "REPLACED",
      bannerUrl: "https://attacker.invalid/banner.jpg",
      bannerPublicId: publicId,
      bannerDescriptor: "signed-descriptor",
      bannerCleanupToken: "signed-cleanup-token",
    }),
  ));

  assert.equal(response.status, 201);
  assert.equal(programs[0].bannerUrl, `/uploads/${publicId}`);
  assert.equal(verifyNewUploadMock.mock.callCount(), 1);
  const uploadContext = verifyNewUploadMock.mock.calls[0].arguments[2] as {
    userId: string;
    purpose: string;
    mode: string;
  };
  assert.equal(uploadContext.userId, "admin-1");
  assert.equal(uploadContext.purpose, "PROGRAM_BANNER");
  assert.equal(uploadContext.mode, "CREATE");
});

test("ProgramBudaya mutations take ProgramCategory lifecycle locks", async () => {
  const created = await POST(writeRequest(
    "http://localhost/api/programs", "POST", programPayload(),
  ));
  assert.equal(created.status, 201);
  const createPlan = lifecycleMock.mock.calls[0].arguments[1] as {
    entities: Array<{ model: string; id: string }>;
  };
  assert.ok(createPlan.entities.some((entity) =>
    entity.model === "ProgramCategory" && entity.id === directCategory.id,
  ));

  const existing = existingProgram("program-a", "Program A");
  existing.categoryId = directCategory.id;
  programs.push(existing);
  const updated = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", {
      categoryId: excelCategory.id,
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );
  assert.equal(updated.status, 200);
  const updatePlan = lifecycleMock.mock.calls[1].arguments[1] as {
    entities: Array<{ model: string; id: string }>;
  };
  assert.ok(updatePlan.entities.some((entity) =>
    entity.model === "ProgramCategory" && entity.id === directCategory.id,
  ));
  assert.ok(updatePlan.entities.some((entity) =>
    entity.model === "ProgramCategory" && entity.id === excelCategory.id,
  ));
});

test("POST covers inclusive TW boundaries and mismatch rejection", async () => {
  const cases: Array<{
    label: string;
    payload: Record<string, unknown>;
    status: 201 | 400;
    field?: string;
    message?: string;
  }> = [
    {
      label: "TW1 awal dan akhir dengan deadline di luar TW",
      payload: programPayload({
        tw: 1,
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-03-31T23:59:59.999Z",
        uploadDeadline: "2026-04-15T23:59:59.999Z",
      }),
      status: 201,
    },
    {
      label: "TW2 boundary",
      payload: programPayload({
        tw: 2,
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-06-30T23:59:59.999Z",
        uploadDeadline: "2026-07-15T23:59:59.999Z",
      }),
      status: 201,
    },
    {
      label: "TW3 boundary",
      payload: programPayload({
        tw: 3,
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-09-30T23:59:59.999Z",
        uploadDeadline: "2026-10-15T23:59:59.999Z",
      }),
      status: 201,
    },
    {
      label: "TW4 boundary",
      payload: programPayload({
        tw: 4,
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.999Z",
        uploadDeadline: "2027-01-15T23:59:59.999Z",
      }),
      status: 201,
    },
    {
      label: "start sebelum TW2",
      payload: programPayload({
        tw: 2,
        startDate: "2026-03-15T00:00:00.000Z",
        endDate: "2026-04-30T23:59:59.999Z",
      }),
      status: 400,
      field: "startDate",
      message: "Tanggal mulai harus berada dalam rentang bulan TW2",
    },
    {
      label: "start sesudah TW2",
      payload: programPayload({
        tw: 2,
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-31T23:59:59.999Z",
      }),
      status: 400,
      field: "startDate",
      message: "Tanggal mulai harus berada dalam rentang bulan TW2",
    },
    {
      label: "end sebelum TW3",
      payload: programPayload({
        tw: 3,
        startDate: "2026-07-15T00:00:00.000Z",
        endDate: "2026-06-30T23:59:59.999Z",
      }),
      status: 400,
      field: "endDate",
      message: "Tanggal selesai harus berada dalam rentang bulan TW3",
    },
    {
      label: "end sesudah TW3",
      payload: programPayload({
        tw: 3,
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-10-01T23:59:59.999Z",
      }),
      status: 400,
      field: "endDate",
      message: "Tanggal selesai harus berada dalam rentang bulan TW3",
    },
  ];

  for (const scenario of cases) {
    const createCallsBefore = tx.programBudaya.create.mock.callCount();
    const response = await POST(
      writeRequest("http://localhost/api/programs", "POST", scenario.payload),
    );
    const body = await responseBody(response);

    assert.equal(response.status, scenario.status, scenario.label);
    if (scenario.status === 201) {
      assert.equal(body.error, false, scenario.label);
      continue;
    }
    assert.equal(body.error, true);
    assert.equal(body.message, "Validasi input gagal");
    assert.equal(body.data, null);
    assert.ok(scenario.field);
    assert.ok(scenario.message);
    const fieldErrors = body.errors?.properties?.[scenario.field]?.errors ?? [];
    assert.ok(fieldErrors.includes(scenario.message), scenario.label);
    assert.equal(tx.programBudaya.create.mock.callCount(), createCallsBefore);
  }
});

test("PUT rejects an incomplete category capability tuple", async () => {
  programs.push(existingProgram("program-a", "Program A"));

  const response = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", {
      categoryId: invalidCategory.id,
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );

  assert.equal(response.status, 422);
  assert.equal(tx.programBudaya.updateMany.mock.callCount(), 0);
});

test("PUT rejects a stale expectedUpdatedAt before mutation", async () => {
  programs.push(existingProgram("program-a", "Program A"));
  const response = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", {
      name: "Stale update",
      expectedUpdatedAt: "2025-01-01T00:00:00.000Z",
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );

  assert.equal(response.status, 409);
  assert.equal(programs[0].name, "Program A");
});

test("PUT stores a verified canonical replacement and schedules managed old-banner cleanup", async () => {
  const oldKey = "banners/programs/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg";
  const newKey = "banners/programs/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg";
  const program = existingProgram("program-a", "Program A");
  program.bannerUrl = `/uploads/${oldKey}`;
  programs.push(program);

  const response = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", {
      bannerState: "REPLACED",
      bannerUrl: "https://attacker.invalid/banner.jpg",
      bannerPublicId: newKey,
      bannerDescriptor: "signed-descriptor",
      bannerCleanupToken: "signed-cleanup-token",
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );

  assert.equal(response.status, 200);
  assert.equal(programs[0].bannerUrl, `/uploads/${newKey}`);
  assert.equal(captureProgramOwnerMock.mock.callCount(), 1);
  assert.equal(cleanupOldUploadMock.mock.callCount(), 1);
  const uploadContext = verifyNewUploadMock.mock.calls[0].arguments[2] as {
    userId: string;
    purpose: string;
    mode: string;
  };
  assert.equal(uploadContext.userId, "admin-1");
  assert.equal(uploadContext.purpose, "PROGRAM_BANNER");
  assert.equal(uploadContext.mode, "REPLACEMENT");
});

test("PATCH requires a matching version and applies only the active flag", async () => {
  programs.push(existingProgram("program-a", "Program A"));
  const current = programs[0].updatedAt.toISOString();
  const stale = await PATCH(
    writeRequest("http://localhost/api/programs/program-a", "PATCH", {
      isActive: false,
      expectedUpdatedAt: "2025-01-01T00:00:00.000Z",
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );
  assert.equal(stale.status, 409);
  assert.equal(programs[0].isActive, true);

  const accepted = await PATCH(
    writeRequest("http://localhost/api/programs/program-a", "PATCH", {
      isActive: false,
      expectedUpdatedAt: current,
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );
  assert.equal(accepted.status, 200);
  assert.equal(programs[0].isActive, false);
});

test("PUT excludes its own id from the direct-program duplicate check", async () => {
  const program = existingProgram("program-a", "Program A");
  Object.assign(program, {
    categoryId: directCategory.id,
    frequency: 1,
    tw: 1,
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-03-31T23:59:59.999Z"),
    uploadDeadline: new Date("2026-04-10T23:59:59.999Z"),
  });
  programs.push(program);

  const response = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", {
      frequency: 8,
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );

  assert.equal(response.status, 200);
  assert.equal(programs[0].frequency, 1);
  assert.equal(tx.programBudaya.findFirst.mock.callCount(), 1);
  const args = tx.programBudaya.findFirst.mock.calls[0].arguments[0] as {
    where: { id: { not: string } };
  };
  assert.deepEqual(args.where.id, { not: "program-a" });
});

test("parallel updates to one direct identity exclude self and return one 200 plus one 409", async () => {
  programs.push(
    existingProgram("program-a", "Program A"),
    existingProgram("program-b", "Program B"),
  );
  const payload = programPayload({
    frequency: 7,
    tw: 2,
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-06-30T23:59:59.999Z",
    uploadDeadline: "2026-07-10T23:59:59.999Z",
  });

  const responses = await Promise.all([
    PUT(
      writeRequest("http://localhost/api/programs/program-a", "PUT", payload),
      { params: Promise.resolve({ id: "program-a" }) },
    ),
    PUT(
      writeRequest("http://localhost/api/programs/program-b", "PUT", payload),
      { params: Promise.resolve({ id: "program-b" }) },
    ),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
  const directRows = programs.filter(
    (program) =>
      program.categoryId === directCategory.id &&
      program.tw === 2 &&
      program.startDate.getUTCFullYear() === 2026,
  );
  assert.equal(directRows.length, 1);
  assert.equal(directRows[0].frequency, 1);
  assert.deepEqual(advisoryKeys, [
    `direct-program:${directCategory.id}:2026:2`,
    `direct-program:${directCategory.id}:2026:2`,
  ]);
});

test("PUT rejects an invalid merged period before conflict lookup and write", async () => {
  programs.push(existingProgram("program-a", "Program A"));

  const response = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", {
      endDate: "2025-12-31T23:59:59.999Z",
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );
  const body = await responseBody(response);

  assert.equal(response.status, 400);
  assert.equal(body.error, true);
  assert.equal(body.message, "Validasi input gagal");
  assert.equal(activityCountMock.mock.callCount(), 0);
  assert.equal(transactionMock.mock.callCount(), 0);
  assert.equal(tx.programBudaya.updateMany.mock.callCount(), 0);
});

test("PUT rejects unrelated changes to an existing TW mismatch", async () => {
  const program = existingProgram("program-a", "Program A");
  Object.assign(program, {
    tw: 1,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-05-31T23:59:59.999Z"),
    uploadDeadline: new Date("2026-06-10T23:59:59.999Z"),
  });
  programs.push(program);

  const response = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", {
      name: "Nama baru",
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );
  const body = await responseBody(response);

  assert.equal(response.status, 400);
  assert.equal(body.message, "Validasi input gagal");
  assert.equal(activityCountMock.mock.callCount(), 0);
  assert.equal(transactionMock.mock.callCount(), 0);
  assert.equal(tx.programBudaya.updateMany.mock.callCount(), 0);
});

test("PUT rejects a TW change that makes the merged period invalid", async () => {
  programs.push(existingProgram("program-a", "Program A"));

  const response = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", { tw: 2 }),
    { params: Promise.resolve({ id: "program-a" }) },
  );
  const body = await responseBody(response);

  assert.equal(response.status, 400);
  assert.equal(body.error, true);
  assert.equal(body.message, "Validasi input gagal");
  assert.equal(tx.programBudaya.updateMany.mock.callCount(), 0);
});

test("PUT accepts period correction and deadline outside the TW", async () => {
  const legacy = existingProgram("program-a", "Legacy");
  Object.assign(legacy, {
    tw: 1,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-05-31T23:59:59.999Z"),
    uploadDeadline: new Date("2026-06-10T23:59:59.999Z"),
  });
  programs.push(legacy);

  const corrected = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", {
      startDate: "2026-02-01T00:00:00.000Z",
      endDate: "2026-03-31T23:59:59.999Z",
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );
  assert.equal(corrected.status, 200);
  assert.equal(tx.programBudaya.updateMany.mock.callCount(), 1);

  const valid = existingProgram("program-b", "Program B");
  Object.assign(valid, {
    tw: 1,
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-03-31T23:59:59.999Z"),
  });
  programs.push(valid);
  const deadlineOutsideTw = await PUT(
    writeRequest("http://localhost/api/programs/program-b", "PUT", {
      uploadDeadline: "2027-01-15T23:59:59.999Z",
    }),
    { params: Promise.resolve({ id: "program-b" }) },
  );
  assert.equal(deadlineOutsideTw.status, 200);
  assert.equal(tx.programBudaya.updateMany.mock.callCount(), 2);
});

test("PUT rejects category change when program already has existing activity reports with 409", async () => {
  programs.push(existingProgram("program-a", "Program A"));
  activityCountMock.mock.mockImplementationOnce(async () => 3);

  const response = await PUT(
    writeRequest("http://localhost/api/programs/program-a", "PUT", {
      categoryId: directCategory.id,
    }),
    { params: Promise.resolve({ id: "program-a" }) },
  );
  const body = await responseBody(response);

  assert.equal(response.status, 409);
  assert.equal(body.error, true);
  assert.equal(
    body.message,
    "Kategori program tidak dapat diubah karena sudah memiliki laporan kegiatan",
  );
  assert.equal(transactionMock.mock.callCount(), 1);
  assert.equal(tx.programBudaya.updateMany.mock.callCount(), 0);
});
