import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";

type User = {
  role: string;
  unitId?: string | null;
  unitType?: string | null;
};

const requireAuthMock = mock.fn(async () => ({
  user: { id: "pic-1", role: "PIC", unitId: "unit-pic" } as User,
}));
const groupByMock = mock.fn(async (_args: unknown) => {
  void _args;
  return [
    { programId: "program-1", _count: { id: 2 } },
  ];
});
const resolveScopeMock = mock.fn(async () => ({ whereClause: {} }));

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError,
    requireAuth: requireAuthMock,
    handleApiError: (error: unknown) =>
      Response.json(
        {
          error: true,
          message: error instanceof Error ? error.message : "internal",
        },
        { status: error instanceof ApiError ? error.status : 500 },
      ),
  },
});
mock.module("@/lib/api/unit-scope", {
  namedExports: { resolveScope: resolveScopeMock },
});
mock.module("@/lib/prisma", {
  namedExports: { prisma: { activityReport: { groupBy: groupByMock } } },
});

let GET: (request: Request) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  requireAuthMock.mock.resetCalls();
  requireAuthMock.mock.mockImplementation(async () => ({
    user: { id: "pic-1", role: "PIC", unitId: "unit-pic" } as User,
  }));
  groupByMock.mock.resetCalls();
  groupByMock.mock.mockImplementation(async (_args) => {
    void _args;
    return [{ programId: "program-1", _count: { id: 2 } }];
  });
  resolveScopeMock.mock.resetCalls();
  resolveScopeMock.mock.mockImplementation(async () => ({ whereClause: {} }));
});

function request(query = "month=4&year=2026") {
  return new Request(`http://localhost/api/kalender/progress?${query}`);
}

test("counts approved reports for the full quarter containing May", async () => {
  const response = await GET(request("month=4&year=2026"));
  const body = await response.json();
  const query = groupByMock.mock.calls[0].arguments[0] as {
    where: {
      status: string;
      tanggalKegiatan: { gte: Date; lt: Date };
    };
  };

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, [{ programId: "program-1", approvedCount: 2 }]);
  assert.equal(query.where.status, "APPROVED");
  assert.equal(query.where.tanggalKegiatan.gte.getTime(), new Date(2026, 3, 1).getTime());
  assert.equal(query.where.tanggalKegiatan.lt.getTime(), new Date(2026, 6, 1).getTime());
});

test("restricts PIC progress to the exact assigned unit", async () => {
  await GET(request());

  const query = groupByMock.mock.calls[0].arguments[0] as {
    where: { unitId: string };
  };
  assert.equal(query.where.unitId, "unit-pic");
  assert.equal(resolveScopeMock.mock.calls.length, 0);
});

test("blocks a PIC without an assigned unit", async () => {
  requireAuthMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", role: "PIC", unitId: null } as User,
  }));

  await GET(request());

  const query = groupByMock.mock.calls[0].arguments[0] as {
    where: { unitId: string };
  };
  assert.equal(query.where.unitId, "BLOCKED");
});

test("uses the resolved all-unit scope for ADMIN", async () => {
  requireAuthMock.mock.mockImplementationOnce(async () => ({
    user: { id: "admin-1", role: "ADMIN", unitId: null } as User,
  }));
  resolveScopeMock.mock.mockImplementationOnce(async () => ({
    whereClause: { unitId: { in: ["unit-a", "unit-b"] } },
  }));

  await GET(request());

  const query = groupByMock.mock.calls[0].arguments[0] as {
    where: { unitId: { in: string[] } };
  };
  assert.deepEqual(query.where.unitId.in, ["unit-a", "unit-b"]);
  assert.equal(resolveScopeMock.mock.calls.length, 1);
});

test("rejects missing month or year before querying the database", async () => {
  assert.equal((await GET(request("year=2026"))).status, 400);
  assert.equal((await GET(request("month=4"))).status, 400);
  assert.equal(groupByMock.mock.calls.length, 0);
});

test("preserves authentication failures before querying the database", async () => {
  requireAuthMock.mock.mockImplementationOnce(async () => {
    throw new ApiError("Unauthorized", 401);
  });

  const response = await GET(request());

  assert.equal(response.status, 401);
  assert.equal(groupByMock.mock.calls.length, 0);
});
