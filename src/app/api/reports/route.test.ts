import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";

class TestApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const authMock = mock.fn(async () => ({
  user: {
    id: "admin-1",
    name: "Admin",
    role: "ADMIN",
    authProvider: "LOCAL",
    unitId: null,
  },
}));
const resolveScopeMock = mock.fn(async () => ({ whereClause: {} }));
const groupByMock = mock.fn(async (_args?: any) => [] as any[]);
const countMock = mock.fn(async (_args?: any) => 0);
const findManyMock = mock.fn(async (_args?: any) => [] as any[]);

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: TestApiError,
    requireAuth: authMock,
    requirePic: authMock,
    handleApiError: (error: unknown) => {
      const isApiError = error instanceof TestApiError;
      return Response.json(
        {
          error: true,
          message: isApiError ? error.message : "internal",
        },
        { status: isApiError ? error.status : 500 },
      );
    },
  },
});
mock.module("@/lib/api/unit-scope", {
  namedExports: { resolveScope: resolveScopeMock },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      activityReport: {
        groupBy: groupByMock,
        count: countMock,
        findMany: findManyMock,
      },
    },
  },
});

let GET: (request: NextRequest) => Promise<Response>;
before(async () => {
  ({ GET } = await import("./route"));
});
beforeEach(() => {
  authMock.mock.resetCalls();
  resolveScopeMock.mock.resetCalls();
  groupByMock.mock.resetCalls();
  countMock.mock.resetCalls();
  findManyMock.mock.resetCalls();
});

function request(query: string) {
  return new NextRequest(`http://localhost/api/reports?${query}`);
}

async function responseBody(response: Response) {
  return response.json() as Promise<{
    error: boolean;
    message: string;
    data: {
      data: Array<Record<string, unknown>>;
      summary: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
      };
      pagination: { page: number; limit: number; total: number };
    };
  }>;
}

async function assertOrderBy(
  query: string,
  expectedOrderBy: unknown,
  expectedPagination?: { skip: number; take: number },
) {
  findManyMock.mock.mockImplementationOnce(
    async (args: { orderBy: unknown; skip: number; take: number }) => {
      assert.deepEqual(args.orderBy, expectedOrderBy);
      if (expectedPagination) {
        assert.equal(args.skip, expectedPagination.skip);
        assert.equal(args.take, expectedPagination.take);
      }
      return [];
    },
  );

  const response = await GET(request(query));
  assert.equal(response.status, 200);
}

test("EVIDENCE includes both photo modes and excludes NONE", async () => {
  const evidenceWhere = {
    program: { category: { evidenceMode: { not: "NONE" } } },
  };
  groupByMock.mock.mockImplementationOnce(async (args: { where: unknown }) => {
    assert.deepEqual(args.where, evidenceWhere);
    return [];
  });
  countMock.mock.mockImplementationOnce(async (args: { where: unknown }) => {
    assert.deepEqual(args.where, evidenceWhere);
    return 2;
  });
  findManyMock.mock.mockImplementationOnce(
    async (args: { where: unknown; skip: number; take: number }) => {
      assert.deepEqual(args.where, evidenceWhere);
      assert.equal(args.skip, 10);
      assert.equal(args.take, 5);
      return [
        {
          id: "report-ai",
          program: {
            id: "program-ai",
            name: "Kegiatan",
            category: {
              id: "category-ai",
              name: "Aktivitas",
              color: null,
              targetUnit: "KEGIATAN",
              evidenceMode: "PHOTO_WITH_AI",
              scoreInputMode: "NONE",
            },
          },
        },
        {
          id: "report-1",
          program: {
            id: "program-1",
            name: "TOGA",
            category: {
              id: "category-1",
              name: "Bukti",
              color: null,
              targetUnit: "PARTISIPASI_PERSEN",
              evidenceMode: "PHOTO_WITHOUT_AI",
              scoreInputMode: "DIRECT_ADMIN",
            },
          },
        },
      ];
    },
  );

  const response = await GET(request("purpose=EVIDENCE&page=3&limit=5"));
  const body = await responseBody(response);
  assert.equal(response.status, 200);
  assert.equal(body.error, false);
  assert.equal(body.data.data.length, 2);
  assert.equal(body.data.pagination.page, 3);
  assert.equal(body.data.pagination.limit, 5);
  assert.equal("percentage" in body.data.data[0], false);
  assert.equal("score" in body.data.data[0], false);
  assert.equal("assessedBy" in body.data.data[0], false);
});

test("ALL keeps KEGIATAN compatibility and invalid purpose returns 400", async () => {
  groupByMock.mock.mockImplementationOnce(async (args: { where: unknown }) => {
    assert.deepEqual(args.where, {
      program: { category: { targetUnit: "KEGIATAN" } },
    });
    return [];
  });
  const allResponse = await GET(request("purpose=ALL"));
  assert.equal(allResponse.status, 200);

  const invalidResponse = await GET(request("purpose=INVALID"));
  const invalidBody = (await invalidResponse.json()) as {
    error: boolean;
    message: string;
  };
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidBody.error, true);
  assert.equal(typeof invalidBody.message, "string");
});

test("Approval sort orders pending by last submission FIFO with id ASC tie-break", async () => {
  await assertOrderBy(
    "status=PENDING&sortMode=APPROVAL",
    [{ lastSubmittedAt: "asc" }, { id: "asc" }],
    { skip: 0, take: 10 },
  );
});

test("Approval sort orders reviewed and all reports by updatedAt DESC with id DESC tie-break", async () => {
  for (const status of ["APPROVED", "REJECTED", "ALL"]) {
    await assertOrderBy(`status=${status}&sortMode=APPROVAL`, [
      { updatedAt: "desc" },
      { id: "desc" },
    ]);
  }
});

test("rejects unsupported sortMode with 400", async () => {
  const response = await GET(request("sortMode=LATEST"));
  assert.equal(response.status, 400);
  assert.equal(resolveScopeMock.mock.calls.length, 0);
  assert.equal(groupByMock.mock.calls.length, 0);
  assert.equal(countMock.mock.calls.length, 0);
  assert.equal(findManyMock.mock.calls.length, 0);
});

test("preserves legacy createdAt ordering for consumers without Approval sortMode", async () => {
  await assertOrderBy("sortOrder=desc", [
    { createdAt: "desc" },
    { id: "desc" },
  ]);
  await assertOrderBy("", [{ createdAt: "asc" }, { id: "asc" }]);
});

test("applies year, TW, and unit type to summary and list scope", async () => {
  const scopedWhere = {
    program: {
      category: { evidenceMode: { not: "NONE" } },
      startDate: {
        gte: new Date(Date.UTC(2026, 0, 1)),
        lt: new Date(Date.UTC(2027, 0, 1)),
      },
      tw: 2,
    },
    unit: { is: { type: { in: ["KANTOR_WILAYAH", "KANTOR_CABANG"] } } },
  };
  groupByMock.mock.mockImplementationOnce(async (args: { where: unknown }) => {
    assert.deepEqual(args.where, scopedWhere);
    return [{ status: "PENDING", _count: 2 }];
  });
  countMock.mock.mockImplementationOnce(async (args: { where: unknown }) => {
    assert.deepEqual(args.where, scopedWhere);
    return 2;
  });
  findManyMock.mock.mockImplementationOnce(
    async (args: { where: unknown }) => {
      assert.deepEqual(args.where, scopedWhere);
      return [];
    },
  );

  const response = await GET(
    request("purpose=EVIDENCE&year=2026&tw=2&unitType=WILAYAH_AND_CABANG"),
  );
  const body = await responseBody(response);
  assert.equal(response.status, 200);
  assert.deepEqual(body.data.summary, {
    total: 2,
    pending: 2,
    approved: 0,
    rejected: 0,
  });
});

test("status and search narrow only the list, not its summary", async () => {
  const summaryWhere = {
    program: { category: { evidenceMode: { not: "NONE" } } },
  };
  const listWhere = {
    ...summaryWhere,
    OR: [
      { activityName: { contains: "beras", mode: "insensitive" } },
      { lokasi: { contains: "beras", mode: "insensitive" } },
      { description: { contains: "beras", mode: "insensitive" } },
      { program: { name: { contains: "beras", mode: "insensitive" } } },
      { createdBy: { name: { contains: "beras", mode: "insensitive" } } },
    ],
    status: "PENDING",
  };
  groupByMock.mock.mockImplementationOnce(async (args: { where: unknown }) => {
    assert.deepEqual(args.where, summaryWhere);
    return [{ status: "PENDING", _count: 3 }, { status: "APPROVED", _count: 1 }];
  });
  countMock.mock.mockImplementationOnce(async (args: { where: unknown }) => {
    assert.deepEqual(args.where, listWhere);
    return 3;
  });
  findManyMock.mock.mockImplementationOnce(async (args: { where: unknown }) => {
    assert.deepEqual(args.where, listWhere);
    return [];
  });

  const response = await GET(
    request("purpose=EVIDENCE&status=PENDING&search=beras"),
  );
  const body = await responseBody(response);
  assert.equal(response.status, 200);
  assert.deepEqual(body.data.summary, {
    total: 4,
    pending: 3,
    approved: 1,
    rejected: 0,
  });
  assert.equal(body.data.pagination.total, 3);
});

test("rejects invalid Approval period and unit type filters before querying", async () => {
  for (const query of [
    "year=2026.5",
    "year=2101",
    "tw=5",
    "unitType=UNKNOWN",
  ]) {
    const response = await GET(request(query));
    assert.equal(response.status, 400, query);
  }
  assert.equal(resolveScopeMock.mock.callCount(), 0);
  assert.equal(groupByMock.mock.callCount(), 0);
  assert.equal(countMock.mock.callCount(), 0);
  assert.equal(findManyMock.mock.callCount(), 0);
});
