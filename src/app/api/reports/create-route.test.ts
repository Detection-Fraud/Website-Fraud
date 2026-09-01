import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";

class TestApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const authMock = mock.fn(async () => ({
  user: { id: "pic-1", name: "PIC", role: "PIC", unitId: "unit-1" as string | null },
}));
const userFindFirstMock = mock.fn(async () => ({ id: "pic-1", unitId: "unit-1" }));
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
let created = false;
const reportFindFirstMock = mock.fn(async () => (created ? { id: "report-1" } : null as { id: string } | null));
const reportCreateMock = mock.fn(async () => {
  created = true;
  return { id: "report-1", photos: [], createdBy: { id: "pic-1", name: "PIC" } };
});
const queryRawMock = mock.fn(async () => undefined);
let transactionTail = Promise.resolve();
const transactionMock = mock.fn(async (callback: (tx: unknown) => unknown) => {
  const run = transactionTail.then(() =>
    callback({
      $queryRaw: queryRawMock,
      activityReport: { findFirst: reportFindFirstMock, create: reportCreateMock },
    }),
  );
  transactionTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
});
const rateLimitMock = mock.fn(() => ({ success: true }));
const rateLimitResponseMock = mock.fn();
const errorResponseMock = mock.fn((message: string, status: number, data: unknown = null) => ({
  success: false,
  error: true,
  status,
  message,
  data,
}));
const successResponseMock = mock.fn((data: unknown, message: string) => ({
  success: true,
  error: false,
  data,
  message,
}));
const formatZodErrorMock = mock.fn(() => "payload tidak valid");
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
mock.module("@/lib/api/rate-limit", {
  namedExports: { checkRateLimit: rateLimitMock, rateLimitResponse: rateLimitResponseMock },
});
mock.module("@/lib/api/unit-scope", { namedExports: { resolveScope: mock.fn() } });
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
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
    formatZodError: formatZodErrorMock,
  },
});
mock.module("@generated/prisma", {
  namedExports: {
    Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) },
  },
});

let POST: (request: Request) => Promise<Response>;
before(async () => ({ POST } = await import("./route")));
beforeEach(() => {
  authMock.mock.resetCalls();
  userFindFirstMock.mock.resetCalls();
  programFindUniqueMock.mock.resetCalls();
  reportFindFirstMock.mock.resetCalls();
  reportCreateMock.mock.resetCalls();
  queryRawMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
  transactionTail = Promise.resolve();
  created = false;
  authMock.mock.mockImplementation(async () => ({
    user: { id: "pic-1", name: "PIC", role: "PIC", unitId: "unit-1" as string | null },
  }));
  userFindFirstMock.mock.mockImplementation(async () => ({ id: "pic-1", unitId: "unit-1" }));
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
  reportFindFirstMock.mock.mockImplementation(async () => (created ? { id: "report-1" } : null));
  isProgramUploadOpenMock.mock.mockImplementation(() => true);
  isActivityDateInsideProgramMock.mock.mockImplementation(() => true);
});

function request(photos: number, programId = "11111111-1111-4111-8111-111111111111") {
  return new NextRequest("http://localhost/api/reports", {
    method: "POST",
    body: JSON.stringify({
      activityName: "Kegiatan budaya",
      tanggalKegiatan: "2026-06-01",
      lokasi: "Aula",
      description: "Dokumentasi kegiatan budaya",
      programId,
      uploadedPhotos: Array.from({ length: photos }, (_, index) => ({
        originalName: `foto-${index}.jpg`,
        imageUrl: `/uploads/foto-${index}.jpg`,
      })),
    }),
    headers: { "content-type": "application/json" },
  });
}

async function body(response: Response) {
  return response.json() as Promise<{
    error: boolean;
    status?: number;
    message: string;
    data: unknown;
  }>;
}

test("role dan unit guard menolak unauthenticated, non-PIC, dan PIC tanpa unit", async () => {
  authMock.mock.mockImplementationOnce(async () => {
    throw new TestApiError("Unauthorized", 401);
  });
  assert.equal((await POST(request(1))).status, 401);
  authMock.mock.mockImplementationOnce(async () => {
    throw new TestApiError("Hanya PIC yang dapat mengakses fitur ini", 403);
  });
  assert.equal((await POST(request(1))).status, 403);
  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", name: "PIC", role: "PIC", unitId: null },
  }));
  assert.equal((await POST(request(1))).status, 403);
});

test("menerima tepat satu atau dua foto, menolak nol atau tiga foto", async () => {
  assert.equal((await POST(request(0))).status, 400);
  assert.equal((await POST(request(3))).status, 400);
  assert.equal((await POST(request(1))).status, 201);
  created = false;
  assert.equal((await POST(request(2))).status, 201);
});

test("hanya evidence capability yang diterima dan duplicate berlaku untuk semua status", async () => {
  programFindUniqueMock.mock.mockImplementation(async () => ({
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    uploadDeadline: new Date("2026-12-31"),
    category: {
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "NONE",
      scoreInputMode: "EXCEL_IMPORT",
    },
  }));
  const noEvidence = await POST(request(1));
  assert.equal(noEvidence.status, 422);
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
  for (const status of ["PENDING", "APPROVED", "REJECTED"]) {
    reportFindFirstMock.mock.mockImplementationOnce(async () => ({
      id: `existing-${status.toLowerCase()}`,
      status,
    }));
    const duplicate = await POST(request(1));
    const duplicateBody = await body(duplicate);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicateBody.data, null);
    assert.deepEqual(
      (reportFindFirstMock.mock.calls.at(-1) as any)?.arguments[0],
      {
        where: { unitId: "unit-1", programId: "11111111-1111-4111-8111-111111111111" },
        select: { id: true },
      },
    );
  }
});

test("menolak tuple capability invalid meskipun evidence mode tersedia", async () => {
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

  assert.equal((await POST(request(1))).status, 422);
  assert.equal(transactionMock.mock.callCount(), 0);
});

test("parallel direct-admin create menghasilkan satu report dan satu loser 409", async () => {
  const responses = await Promise.all([POST(request(1)), POST(request(1))]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal(reportCreateMock.mock.callCount(), 1);
  assert.equal(transactionMock.mock.callCount(), 2);
});

test("KEGIATAN tetap boleh membuat multiple report", async () => {
  programFindUniqueMock.mock.mockImplementation(async () => ({
    isActive: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    uploadDeadline: new Date("2026-12-31"),
    category: {
      targetUnit: "KEGIATAN",
      evidenceMode: "PHOTO_WITH_AI",
      scoreInputMode: "NONE",
    },
  }));
  assert.equal((await POST(request(1))).status, 201);
  assert.equal((await POST(request(1))).status, 201);
  assert.equal(reportCreateMock.mock.callCount(), 2);
  assert.equal(queryRawMock.mock.callCount(), 0);
});
