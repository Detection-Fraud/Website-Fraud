import { NextRequest } from "next/server";
import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

const authMock = mock.fn(async () => ({
  user: { id: "admin-1", role: "ADMIN" },
}));
const categoryFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => [],
);
const categoryUsageMock = mock.fn(
  async (ids: string[]) =>
    new Map(
      ids.map((id) => [
        id,
        {
          programCount: 0,
          activeProgramCount: 0,
          reportCount: 0,
          participationCount: 0,
          historyCount: 0,
        },
      ]),
    ),
);

const getCategoryLocksMock = mock.fn(
  (usage: {
    programCount: number;
    reportCount: number;
    participationCount: number;
    historyCount: number;
  }) => {
    const used =
      usage.programCount > 0 ||
      usage.reportCount > 0 ||
      usage.participationCount > 0 ||
      usage.historyCount > 0;
    return { capability: used, deletion: used };
  },
);

mock.module("@/auth", {
  namedExports: { auth: authMock },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      programCategory: { findMany: categoryFindManyMock },
    },
  },
});
mock.module("@/lib/api/category-usage", {
  namedExports: {
    getCategoryUsageByCategoryIds: categoryUsageMock,
    getCategoryLocks: getCategoryLocksMock,
  },
});

let GET: (req: Request) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});

function request() {
  return new NextRequest(
    "http://localhost/api/programs/categories?targetUnit=PARTISIPASI_PERSEN&evidenceMode=NONE&scoreInputMode=EXCEL_IMPORT",
  );
}

async function responseBody(response: Response) {
  return response.json() as Promise<{
    success: boolean;
    error: boolean;
    message: string;
    data: Array<Record<string, unknown>>;
  }>;
}

test("GET returns aggregate usage, locks, aliases, filters, and envelope", async () => {
  const zeroUsageId = "category-zero";
  const populatedUsageId = "category-used";

  categoryFindManyMock.mock.mockImplementationOnce(
    async (args: { where: unknown; orderBy: unknown }) => {
      assert.deepEqual(args.where, {
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "NONE",
        scoreInputMode: "EXCEL_IMPORT",
      });
      assert.deepEqual(args.orderBy, { createdAt: "asc" });

      return [
        {
          id: zeroUsageId,
          name: "Kategori Kosong",
          targetUnit: "PARTISIPASI_PERSEN",
          evidenceMode: "NONE",
          scoreInputMode: "EXCEL_IMPORT",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: populatedUsageId,
          name: "Kategori Terpakai",
          targetUnit: "PARTISIPASI_PERSEN",
          evidenceMode: "NONE",
          scoreInputMode: "EXCEL_IMPORT",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ];
    },
  );
  categoryUsageMock.mock.mockImplementationOnce(async (ids: string[]) => {
    assert.deepEqual(ids, [zeroUsageId, populatedUsageId]);
    return new Map([
      [
        zeroUsageId,
        {
          programCount: 0,
          activeProgramCount: 0,
          reportCount: 0,
          participationCount: 0,
          historyCount: 0,
        },
      ],
      [
        populatedUsageId,
        {
          programCount: 3,
          activeProgramCount: 2,
          reportCount: 4,
          participationCount: 5,
          historyCount: 6,
        },
      ],
    ]);
  });

  const response = await GET(request());
  const body = await responseBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.error, false);
  assert.equal(body.message, "Berhasil mengambil data kategori");
  assert.equal(categoryUsageMock.mock.callCount(), 1);
  assert.deepEqual(body.data, [
    {
      id: zeroUsageId,
      name: "Kategori Kosong",
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "NONE",
      scoreInputMode: "EXCEL_IMPORT",
      createdAt: "2026-01-01T00:00:00.000Z",
      usage: {
        programCount: 0,
        activeProgramCount: 0,
        reportCount: 0,
        participationCount: 0,
        historyCount: 0,
      },
      locks: { capability: false, deletion: false },
      totalProgram: 0,
      totalActive: 0,
    },
    {
      id: populatedUsageId,
      name: "Kategori Terpakai",
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "NONE",
      scoreInputMode: "EXCEL_IMPORT",
      createdAt: "2026-01-02T00:00:00.000Z",
      usage: {
        programCount: 3,
        activeProgramCount: 2,
        reportCount: 4,
        participationCount: 5,
        historyCount: 6,
      },
      locks: { capability: true, deletion: true },
      totalProgram: 3,
      totalActive: 2,
    },
  ]);
});
