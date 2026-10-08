import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

const units = [
  {
    id: "unit-reporting",
    name: "Unit Reporting",
    type: "DIVISI",
    wilayah: "Kantor Pusat",
    parentId: null,
  },
  {
    id: "unit-zero",
    name: "Unit Belum Melapor",
    type: "DIVISI",
    wilayah: "Kantor Pusat",
    parentId: null,
  },
];

const resolveScopeMock = mock.fn(async () => ({
  whereClause: { unitId: { in: units.map((unit) => unit.id) } },
  activeUnits: units,
}));
const categoryFindManyMock = mock.fn(
  async (args: {
    include: { programs: { where: Record<string, unknown> } };
  }) => {
    assert.equal(
      "isActive" in args.include.programs.where,
      false,
      "historical programs must remain in the selected period",
    );
    return [
  {
    id: "category-a",
    name: "Kategori A",
    programs: [
      { id: "program-a1", frequency: 1, tw: 1 },
      { id: "program-a2", frequency: 3, tw: 1 },
    ],
  },
  {
    id: "category-b",
    name: "Kategori B",
    programs: [{ id: "program-b1", frequency: 1, tw: 1 }],
  },
    ];
  },
);
const groupByMock = mock.fn(async (args: { where: unknown }) => {
  void args;
  return [
    { unitId: "unit-reporting", programId: "program-a1", _count: { id: 1 } },
    { unitId: "unit-reporting", programId: "program-b1", _count: { id: 3 } },
  ];
});

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    requireAuth: async () => ({ user: { role: "ADMIN" } }),
    handleApiError: (_error: unknown, message: string) =>
      Response.json({ message }, { status: 500 }),
  },
});
mock.module("@/lib/api/unit-scope", {
  namedExports: { resolveScope: resolveScopeMock },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      programCategory: { findMany: categoryFindManyMock },
      activityReport: { groupBy: groupByMock },
    },
  },
});

let GET: (request: Request) => Promise<Response>;
before(async () => {
  ({ GET } = await import("./route"));
});

test("includes zero-report scoped units and averages capped percentages per program", async () => {
  const response = await GET(
    new Request("http://localhost/api/reports/compliance?year=2026"),
  );
  const body = (await response.json()) as {
    data: {
      cards: Record<string, number>;
      tableData: Array<{
        unit: { id: string };
        avg: number;
        programCompliance: Array<{
          programId: string;
          pct: number;
          submitted: number;
          target: number;
        }>;
      }>;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.data.cards.totalUnit, 2);
  assert.equal(body.data.cards.unitOnTrack, 1);
  assert.equal(body.data.cards.perluPerhatian, 1);
  assert.equal(body.data.cards.avgCompliance, (220 / 3) / 2);
  assert.deepEqual(
    body.data.tableData.map((row) => [row.unit.id, row.avg]),
    [
      ["unit-reporting", 220 / 3],
      ["unit-zero", 0],
    ],
  );
  assert.deepEqual(body.data.tableData[0].programCompliance, [
    {
      programId: "category-a",
      pct: 50,
      rawPct: 50,
      submitted: 1,
      target: 4,
    },
    {
      programId: "category-b",
      pct: 120,
      rawPct: 300,
      submitted: 3,
      target: 1,
    },
  ]);
  const groupByArgs = groupByMock.mock.calls[0]?.arguments[0];
  assert.ok(groupByArgs);
  assert.deepEqual(groupByArgs.where, {
    AND: [
      { unitId: { in: units.map((unit) => unit.id) } },
      {
        status: "APPROVED",
        unitId: { not: null },
        programId: { in: ["program-a1", "program-a2", "program-b1"] },
      },
    ],
  });
  assert.equal(resolveScopeMock.mock.calls.length, 1);
});

test("returns an empty result when no programs apply to the selected period", async () => {
  categoryFindManyMock.mock.mockImplementationOnce(async () => []);
  const response = await GET(
    new Request("http://localhost/api/reports/compliance?year=1900"),
  );
  const body = (await response.json()) as {
    data: { cards: Record<string, number>; programs: unknown[]; tableData: unknown[] };
  };

  assert.equal(response.status, 200);
  assert.equal(body.data.cards.totalUnit, 0);
  assert.deepEqual(body.data.programs, []);
  assert.deepEqual(body.data.tableData, []);
});
