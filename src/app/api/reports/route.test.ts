import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";

const authMock = mock.fn(async () => ({ user: { id: "admin-1", role: "ADMIN" } }));
const resolveScopeMock = mock.fn(async () => ({ whereClause: {} }));
const groupByMock = mock.fn(async (_args?: any) => [] as any[]);
const countMock = mock.fn(async (_args?: any) => 0);
const findManyMock = mock.fn(async (_args?: any) => [] as any[]);

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/api/unit-scope", { namedExports: { resolveScope: resolveScopeMock } });
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
      pagination: { page: number; limit: number };
    };
  }>;
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
  findManyMock.mock.mockImplementationOnce(async (args: { where: unknown; skip: number; take: number }) => {
    assert.deepEqual(args.where, evidenceWhere);
    assert.equal(args.skip, 10);
    assert.equal(args.take, 5);
    return [{
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
    }, {
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
    }];
  });

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
    assert.deepEqual(args.where, { program: { category: { targetUnit: "KEGIATAN" } } });
    return [];
  });
  const allResponse = await GET(request("purpose=ALL"));
  assert.equal(allResponse.status, 200);

  const invalidResponse = await GET(request("purpose=INVALID"));
  const invalidBody = await invalidResponse.json() as { error: boolean; message: string };
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidBody.error, true);
  assert.equal(typeof invalidBody.message, "string");
});
