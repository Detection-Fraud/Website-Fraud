import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

const authMock = mock.fn(async () => null as any);
const findFirstMock = mock.fn<(...args: any[]) => Promise<any>>(async () => null);
const findUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(async () => null);

mock.module("@/auth", {
  namedExports: { auth: authMock },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      activityReport: {
        findFirst: findFirstMock,
        findUnique: findUniqueMock,
      },
    },
  },
});

let GET: (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  authMock.mock.resetCalls();
  findFirstMock.mock.resetCalls();
  findUniqueMock.mock.resetCalls();
});

const FORBIDDEN_SCORE_KEYS = [
  "participationAssessment",
  "scoreHistories",
  "percentage",
  "assessedBy",
  "assessedAt",
  "changeReason",
  "score",
] as const;

function assertNoForbiddenKeys(data: Record<string, unknown>) {
  for (const key of FORBIDDEN_SCORE_KEYS) {
    assert.equal(
      key in data,
      false,
      `Forbidden score key "${key}" should be absent from report detail DTO`,
    );
  }
}

const safeReportFixture = {
  id: "report-1",
  activityName: "Sosialisasi Budaya Anti Fraud",
  tanggalKegiatan: new Date("2026-02-15T09:00:00.000Z"),
  lokasi: "Aula Kantor Cabang A",
  description: "Pemaparan materi fraud detection",
  status: "APPROVED",
  createdAt: new Date("2026-02-15T10:00:00.000Z"),
  updatedAt: new Date("2026-02-15T10:00:00.000Z"),
  notes: "Dokumentasi telah diverifikasi",
  unit: {
    id: "unit-cabang-1",
    name: "Kantor Cabang A",
    type: "KANTOR_CABANG",
    parentId: "unit-wilayah-1",
    parent: { id: "unit-wilayah-1", name: "Kantor Wilayah 1" },
  },
  program: {
    id: "program-1",
    name: "Program Budaya 2026",
    category: { id: "cat-1", name: "Anti Fraud", color: "#003366" },
  },
  createdBy: { id: "pic-1", name: "PIC User" },
  photos: [
    {
      id: "photo-1",
      originalName: "bukti.jpg",
      imageUrl: "https://example.test/bukti.jpg",
    },
  ],
  logs: [
    {
      id: "log-1",
      reportId: "report-1",
      action: "SUBMITTED",
      notes: "Laporan disubmit",
      actorName: "PIC User",
      actorRole: "PIC",
      createdAt: new Date("2026-02-15T10:00:00.000Z"),
    },
  ],
};

function createRequest(id = "report-1") {
  return new NextRequest(`http://localhost/api/reports/${id}`);
}

async function responseBody(response: Response) {
  return response.json() as Promise<{
    status: number;
    error: boolean;
    message: string;
    data: any;
  }>;
}

describe("GET /api/reports/[id] - Privacy and Access Regression Tests", () => {
  it("ADMIN receives 200, safe evidence fields, and zero score-related properties", async () => {
    authMock.mock.mockImplementation(async () => ({
      user: { id: "admin-1", role: "ADMIN" },
    }));
    findFirstMock.mock.mockImplementation(async () => safeReportFixture);

    const response = await GET(createRequest("report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });
    const body = await responseBody(response);

    assert.equal(response.status, 200);
    assert.equal(body.error, false);
    assert.equal(body.data.id, "report-1");
    assert.equal(body.data.status, "APPROVED");
    assert.equal(body.data.activityName, "Sosialisasi Budaya Anti Fraud");
    assert.equal(Array.isArray(body.data.photos), true);
    assert.equal(Array.isArray(body.data.logs), true);

    // Verify forbidden score keys are absent (not undefined or null in object keys)
    assertNoForbiddenKeys(body.data);

    // Verify Prisma query where clause for ADMIN only filters by report id
    assert.equal(findFirstMock.mock.callCount(), 1);
    const callArgs = findFirstMock.mock.calls[0].arguments[0] as unknown as {
      where: Record<string, unknown>;
    };
    assert.deepEqual(callArgs.where, { id: "report-1" });
  });

  it("PIC with creator ID and valid unit scope receives 200 and safe DTO", async () => {
    authMock.mock.mockImplementation(async () => ({
      user: {
        id: "pic-1",
        role: "PIC",
        unitId: "unit-cabang-1",
        unitType: "KANTOR_CABANG",
      },
    }));
    findFirstMock.mock.mockImplementation(async () => safeReportFixture);

    const response = await GET(createRequest("report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });
    const body = await responseBody(response);

    assert.equal(response.status, 200);
    assert.equal(body.error, false);
    assert.equal(body.data.id, "report-1");
    assertNoForbiddenKeys(body.data);

    // Verify PIC query includes ownership and unit scope directly in where clause
    assert.equal(findFirstMock.mock.callCount(), 1);
    const callArgs = findFirstMock.mock.calls[0].arguments[0] as unknown as {
      where: Record<string, unknown>;
    };
    assert.equal(callArgs.where.id, "report-1");
    assert.equal(callArgs.where.unitId, "unit-cabang-1");
    assert.equal(callArgs.where.createdById, "pic-1");
  });

  it("PIC with KANTOR_WILAYAH role receives 200 with parent/branch OR query scope", async () => {
    authMock.mock.mockImplementation(async () => ({
      user: {
        id: "pic-kanwil-1",
        role: "PIC",
        unitId: "unit-wilayah-1",
        unitType: "KANTOR_WILAYAH",
      },
    }));
    findFirstMock.mock.mockImplementation(async () => safeReportFixture);

    const response = await GET(createRequest("report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });
    const body = await responseBody(response);

    assert.equal(response.status, 200);
    assert.equal(body.error, false);

    assert.equal(findFirstMock.mock.callCount(), 1);
    const callArgs = findFirstMock.mock.calls[0].arguments[0] as unknown as {
      where: Record<string, unknown>;
    };
    assert.equal(callArgs.where.id, "report-1");
    assert.equal(callArgs.where.createdById, "pic-kanwil-1");
    assert.deepEqual(callArgs.where.OR, [
      { unitId: "unit-wilayah-1" },
      { unit: { parentId: "unit-wilayah-1" } },
    ]);
  });

  it("PIC without unitId receives 404 not found", async () => {
    authMock.mock.mockImplementation(async () => ({
      user: { id: "pic-no-unit", role: "PIC", unitId: null },
    }));
    findFirstMock.mock.mockImplementation(async () => null);

    const response = await GET(createRequest("report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });
    const body = await responseBody(response);

    assert.equal(response.status, 404);
    assert.equal(body.error, true);
    assert.equal(body.message, "Laporan tidak ditemukan");
  });

  it("PIC query returning null (wrong owner or outside unit scope) returns 404 without leaking data", async () => {
    authMock.mock.mockImplementation(async () => ({
      user: {
        id: "other-pic",
        role: "PIC",
        unitId: "unit-cabang-2",
        unitType: "KANTOR_CABANG",
      },
    }));
    // Database returns null because where clause does not match
    findFirstMock.mock.mockImplementation(async () => null);

    const response = await GET(createRequest("report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });
    const body = await responseBody(response);

    assert.equal(response.status, 404);
    assert.equal(body.error, true);
    assert.equal(body.data, null);
  });

  it("VIEWER with matching unit scope receives 200 and safe DTO without createdById restriction", async () => {
    authMock.mock.mockImplementation(async () => ({
      user: {
        id: "viewer-1",
        role: "VIEWER",
        unitId: "unit-cabang-1",
        unitType: "KANTOR_CABANG",
      },
    }));
    findFirstMock.mock.mockImplementation(async () => safeReportFixture);

    const response = await GET(createRequest("report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });
    const body = await responseBody(response);

    assert.equal(response.status, 200);
    assert.equal(body.error, false);
    assertNoForbiddenKeys(body.data);

    // Verify VIEWER has unit scope but NOT createdById filter
    assert.equal(findFirstMock.mock.callCount(), 1);
    const callArgs = findFirstMock.mock.calls[0].arguments[0] as unknown as {
      where: Record<string, unknown>;
    };
    assert.equal(callArgs.where.id, "report-1");
    assert.equal(callArgs.where.unitId, "unit-cabang-1");
    assert.equal("createdById" in callArgs.where, false);
  });

  it("VIEWER without unitId receives 404", async () => {
    authMock.mock.mockImplementation(async () => ({
      user: { id: "viewer-no-unit", role: "VIEWER", unitId: null },
    }));
    findFirstMock.mock.mockImplementation(async () => null);

    const response = await GET(createRequest("report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });
    const body = await responseBody(response);

    assert.equal(response.status, 404);
    assert.equal(body.error, true);
  });

  it("unauthenticated request returns 401 error envelope", async () => {
    authMock.mock.mockImplementation(async () => null);

    const response = await GET(createRequest("report-1"), {
      params: Promise.resolve({ id: "report-1" }),
    });
    const body = await responseBody(response);

    assert.equal(response.status, 401);
    assert.equal(body.error, true);
    assert.equal(body.status, 401);
    assert.equal(findFirstMock.mock.callCount(), 0);
  });
});
