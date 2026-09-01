import assert from "node:assert/strict";
import { mock, test } from "node:test";

const programGroupByMock = mock.fn<(...args: any[]) => Promise<any[]>>(
  async () => [],
);
const participationGroupByMock = mock.fn<(...args: any[]) => Promise<any[]>>(
  async () => [],
);
const historyGroupByMock = mock.fn<(...args: any[]) => Promise<any[]>>(
  async () => [],
);
const queryRawMock = mock.fn<(...args: any[]) => Promise<any[]>>(
  async () => [],
);

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      programBudaya: { groupBy: programGroupByMock },
      participationData: { groupBy: participationGroupByMock },
      participationScoreHistory: { groupBy: historyGroupByMock },
      $queryRaw: queryRawMock,
    },
  },
});

let getCategoryLocks: typeof import("./category-usage").getCategoryLocks;
let getCategoryUsageByCategoryIds: typeof import("./category-usage").getCategoryUsageByCategoryIds;

test.before(async () => {
  ({ getCategoryLocks, getCategoryUsageByCategoryIds } = await import(
    "./category-usage"
  ));
});

test("empty category IDs return an empty map without aggregate queries", { concurrency: false }, async () => {
  const result = await getCategoryUsageByCategoryIds([]);

  assert.deepEqual(result, new Map());
  assert.equal(programGroupByMock.mock.callCount(), 0);
  assert.equal(participationGroupByMock.mock.callCount(), 0);
  assert.equal(historyGroupByMock.mock.callCount(), 0);
  assert.equal(queryRawMock.mock.callCount(), 0);
});

test("aggregates five sources in fixed calls, normalizes counts, and zero-fills IDs", { concurrency: false }, async () => {
  const firstId = "category-first";
  const secondId = "category-second";

  programGroupByMock.mock.mockImplementation(
    async (args: { where?: { isActive?: boolean } }) =>
      args.where?.isActive
        ? [{ categoryId: firstId, _count: { _all: BigInt(2) } }]
        : [
            { categoryId: firstId, _count: { _all: BigInt(3) } },
            { categoryId: null, _count: { _all: BigInt(99) } },
          ],
  );
  participationGroupByMock.mock.mockImplementationOnce(async () => [
    { categoryId: firstId, _count: { _all: BigInt(4) } },
    { categoryId: "not-requested", _count: { _all: BigInt(50) } },
  ]);
  historyGroupByMock.mock.mockImplementationOnce(async () => [
    { categoryId: firstId, _count: { _all: BigInt(5) } },
  ]);
  queryRawMock.mock.mockImplementationOnce(async () => [
    { categoryId: firstId, count: BigInt(6) },
    { categoryId: null, count: BigInt(70) },
  ]);

  const result = await getCategoryUsageByCategoryIds([firstId, secondId]);

  assert.deepEqual(result, new Map([
    [firstId, {
      programCount: 3,
      activeProgramCount: 2,
      reportCount: 6,
      participationCount: 4,
      historyCount: 5,
    }],
    [secondId, {
      programCount: 0,
      activeProgramCount: 0,
      reportCount: 0,
      participationCount: 0,
      historyCount: 0,
    }],
  ]));
  assert.equal(programGroupByMock.mock.callCount(), 2);
  assert.equal(participationGroupByMock.mock.callCount(), 1);
  assert.equal(historyGroupByMock.mock.callCount(), 1);
  assert.equal(queryRawMock.mock.callCount(), 1);
  assert.ok(
    result.get(firstId)!.activeProgramCount <= result.get(firstId)!.programCount,
  );

  const sql = (queryRawMock.mock.calls as unknown as Array<{ arguments: unknown[] }>)[0]
    .arguments[0] as {
    strings: readonly string[];
    values: readonly unknown[];
  };
  assert.deepEqual(sql.values, [firstId, secondId]);
  assert.equal(sql.strings.some((part) => part.includes(firstId)), false);
  assert.equal(sql.strings.some((part) => part.includes(secondId)), false);
});

test("both locks remain false when all persisted usage is zero", { concurrency: false }, () => {
  assert.deepEqual(
    getCategoryLocks({
      programCount: 0,
      activeProgramCount: 0,
      reportCount: 0,
      participationCount: 0,
      historyCount: 0,
    }),
    { capability: false, deletion: false },
  );
});

test("active program usage alone does not set either lock", { concurrency: false }, () => {
  assert.deepEqual(
    getCategoryLocks({
      programCount: 0,
      activeProgramCount: 1,
      reportCount: 0,
      participationCount: 0,
      historyCount: 0,
    }),
    { capability: false, deletion: false },
  );
});

for (const field of [
  "programCount",
  "reportCount",
  "participationCount",
  "historyCount",
] as const) {
  test(`a positive ${field} sets both locks`, { concurrency: false }, () => {
    const usage = {
      programCount: 0,
      activeProgramCount: 0,
      reportCount: 0,
      participationCount: 0,
      historyCount: 0,
      [field]: 1,
    };

    assert.deepEqual(getCategoryLocks(usage), {
      capability: true,
      deletion: true,
    });
  });
}

test("unsafe aggregate counts are rejected", { concurrency: false }, async () => {
  programGroupByMock.mock.mockImplementationOnce(async () => [
    { categoryId: "category-unsafe", _count: { _all: Number.MAX_SAFE_INTEGER + 1 } },
  ]);

  await assert.rejects(
    getCategoryUsageByCategoryIds(["category-unsafe"]),
    /safe non-negative integer/,
  );
});
