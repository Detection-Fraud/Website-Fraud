import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";

class TestApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const authMock = mock.fn(async () => ({
  user: { id: "pic-1", name: "PIC", role: "PIC", unitId: "unit-1" },
}));
const reportFindUniqueMock = mock.fn(async () => ({
  id: "report-1",
  createdById: "pic-1",
  unitId: "unit-1",
  programId: "program-1",
  status: "REJECTED",
  tanggalKegiatan: new Date("2026-06-01"),
  photos: [{ id: "old-photo", publicId: null, imageUrl: "https://example.test/old.jpg" }],
}));
const userFindFirstMock = mock.fn(async () => ({ id: "pic-1" }));
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
const updateMock = mock.fn(async () => ({ id: "report-1", status: "PENDING" }));
const logCreateMock = mock.fn(async () => ({ id: "log-1" }));
const deleteManyMock = mock.fn(async () => ({ count: 1 }));
const queryRawMock = mock.fn(async () => undefined);
const transactionMock = mock.fn(async (callback: (tx: unknown) => unknown) =>
  callback({
    $queryRaw: queryRawMock,
    activityReport: { findFirst: mock.fn(async () => null), update: updateMock },
    activityPhoto: { deleteMany: deleteManyMock },
    activityLog: { create: logCreateMock },
  }),
);
const errorResponseMock = (message: string, status: number, data: unknown = null) => ({
  success: false,
  error: true,
  status,
  message,
  data,
});
const successResponseMock = (data: unknown, message: string) => ({
  success: true,
  error: false,
  data,
  message,
});
const isProgramUploadOpenMock = mock.fn(() => true);
const isActivityDateInsideProgramMock = mock.fn(() => true);

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: TestApiError,
    requirePic: authMock,
    handleApiError: (error: unknown) =>
      Response.json(
        errorResponseMock(
          error instanceof TestApiError ? error.message : "internal",
          error instanceof TestApiError ? error.status : 500,
        ),
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
      $transaction: transactionMock,
    },
  },
});
mock.module("@/lib/program-period", {
  namedExports: {
    isProgramUploadOpen: isProgramUploadOpenMock,
    isActivityDateInsideProgram: isActivityDateInsideProgramMock,
  },
});
mock.module("@/lib/response", {
  namedExports: {
    errorResponse: errorResponseMock,
    successResponse: successResponseMock,
    formatZodError: mock.fn(() => "payload tidak valid"),
  },
});
mock.module("@generated/prisma", {
  namedExports: {
    Prisma: {
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
      validator: () => (select: unknown) => select,
    },
  },
});
mock.module("fs/promises", { namedExports: { unlink: mock.fn(async () => undefined) } });

let PUT: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
before(async () => ({ PUT } = await import("./route")));
beforeEach(() => {
  authMock.mock.resetCalls();
  reportFindUniqueMock.mock.resetCalls();
  userFindFirstMock.mock.resetCalls();
  programFindUniqueMock.mock.resetCalls();
  updateMock.mock.resetCalls();
  logCreateMock.mock.resetCalls();
  deleteManyMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
  reportFindUniqueMock.mock.mockImplementation(async () => ({
    id: "report-1",
    createdById: "pic-1",
    unitId: "unit-1",
    programId: "program-1",
    status: "REJECTED",
    tanggalKegiatan: new Date("2026-06-01"),
    photos: [{ id: "old-photo", publicId: null, imageUrl: "https://example.test/old.jpg" }],
  }));
  userFindFirstMock.mock.mockImplementation(async () => ({ id: "pic-1" }));
  isProgramUploadOpenMock.mock.mockImplementation(() => true);
  isActivityDateInsideProgramMock.mock.mockImplementation(() => true);
});

function request(photos: number) {
  return new NextRequest("http://localhost/api/reports/report-1", {
    method: "PUT",
    body: JSON.stringify({
      activityName: "Kegiatan budaya",
      tanggalKegiatan: "2026-06-01",
      lokasi: "Aula",
      description: "Dokumentasi kegiatan budaya",
      photos: Array.from({ length: photos }, (_, index) => ({
        originalName: `baru-${index}.jpg`,
        imageUrl: `/uploads/baru-${index}.jpg`,
        publicId: null,
      })),
    }),
    headers: { "content-type": "application/json" },
  });
}

async function run(photos = 1) {
  return PUT(request(photos), { params: Promise.resolve({ id: "report-1" }) });
}

test("hanya creator pada unit yang sama dapat resubmit report REJECTED", async () => {
  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "other", name: "Other", role: "PIC", unitId: "unit-1" },
  }));
  assert.equal((await run()).status, 403);
  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", name: "PIC", role: "PIC", unitId: "unit-2" },
  }));
  assert.equal((await run()).status, 403);
});

test("PENDING dan APPROVED immutable untuk PIC", async () => {
  reportFindUniqueMock.mock.mockImplementationOnce(async () => ({
    id: "report-1",
    createdById: "pic-1",
    unitId: "unit-1",
    programId: "program-1",
    status: "PENDING",
    tanggalKegiatan: new Date("2026-06-01"),
    photos: [{ id: "photo", publicId: null, imageUrl: "https://example.test/photo.jpg" }],
  }));
  assert.equal((await run()).status, 409);
  reportFindUniqueMock.mock.mockImplementationOnce(async () => ({
    id: "report-1",
    createdById: "pic-1",
    unitId: "unit-1",
    programId: "program-1",
    status: "APPROVED",
    tanggalKegiatan: new Date("2026-06-01"),
    photos: [{ id: "photo", publicId: null, imageUrl: "https://example.test/photo.jpg" }],
  }));
  assert.equal((await run()).status, 409);
  assert.equal(transactionMock.mock.callCount(), 0);
});

test("resubmit memakai ID yang sama, kembali ke PENDING, dan menulis RESUBMITTED", async () => {
  assert.equal((await run(1)).status, 200);
  assert.deepEqual((updateMock.mock.calls as any)[0].arguments[0], {
    where: { id: "report-1" },
    data: {
      activityName: "Kegiatan budaya",
      programId: "program-1",
      tanggalKegiatan: new Date("2026-06-01"),
      lokasi: "Aula",
      description: "Dokumentasi kegiatan budaya",
      status: "PENDING",
      notes: null,
      photos: {
        create: [{ imageUrl: "/uploads/baru-0.jpg", originalName: "baru-0.jpg", publicId: null }],
      },
    },
  });
  assert.equal(logCreateMock.mock.callCount(), 1);
  assert.equal(
    ((logCreateMock.mock.calls as any)[0].arguments[0] as { data: { reportId: string; action: string } })
      .data.reportId,
    "report-1",
  );
  assert.equal(
    ((logCreateMock.mock.calls as any)[0].arguments[0] as { data: { reportId: string; action: string } })
      .data.action,
    "RESUBMITTED",
  );
});

test("nol atau tiga foto ditolak oleh schema, satu atau dua foto diproses", async () => {
  assert.equal((await run(0)).status, 400);
  assert.equal((await run(3)).status, 400);
  assert.equal((await run(1)).status, 200);
  assert.equal((await run(2)).status, 200);
});

test("closed deadline atau event date di luar program menghentikan mutation", async () => {
  isProgramUploadOpenMock.mock.mockImplementationOnce(() => false);
  assert.equal((await run()).status, 403);
  isActivityDateInsideProgramMock.mock.mockImplementationOnce(() => false);
  assert.equal((await run()).status, 400);
  assert.equal(transactionMock.mock.callCount(), 0);
});

test("menolak tuple capability invalid saat resubmit meskipun evidence mode tersedia", async () => {
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
  assert.equal(transactionMock.mock.callCount(), 0);
});
