import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";

const categoryFindUniqueMock = mock.fn(async () => ({
  id: "category-1",
  name: "Kategori 1",
}));
const employeeSyncRunFindFirstMock = mock.fn(async () => ({
  id: "sync-run-1",
}));
const unitFindManyMock = mock.fn(async () => [
  {
    id: "unit-1",
    name: "Unit 1",
    parent: { name: "Parent 1" },
  },
]);
const participationFindManyMock = mock.fn<
  (...args: any[]) => Promise<any[]>
>(async () => []);
const employeeGroupByMock = mock.fn<(...args: any[]) => Promise<any[]>>(
  async () => [],
);
const participationCreateMock = mock.fn(async () => ({
  id: "snapshot-1",
}));
const transactionMock = mock.fn(
  async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      programCategory: { findUnique: categoryFindUniqueMock },
      employeeSyncRun: { findFirst: employeeSyncRunFindFirstMock },
      unit: { findMany: unitFindManyMock },
      participationData: {
        findMany: participationFindManyMock,
        create: participationCreateMock,
      },
      employee: { groupBy: employeeGroupByMock },
    }),
);

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: { $transaction: transactionMock },
  },
});

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: class ApiError extends Error {
      status: number;

      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    },
  },
});

let createParticipationSnapshots: typeof import("./participation-snapshot")["createParticipationSnapshots"];

before(async () => {
  ({ createParticipationSnapshots } = await import("./participation-snapshot"));
});

beforeEach(() => {
  categoryFindUniqueMock.mock.resetCalls();
  employeeSyncRunFindFirstMock.mock.resetCalls();
  unitFindManyMock.mock.resetCalls();
  participationFindManyMock.mock.resetCalls();
  employeeGroupByMock.mock.resetCalls();
  participationCreateMock.mock.resetCalls();
  transactionMock.mock.resetCalls();

  categoryFindUniqueMock.mock.mockImplementation(async () => ({
    id: "category-1",
    name: "Kategori 1",
  }));
  employeeSyncRunFindFirstMock.mock.mockImplementation(async () => ({
    id: "sync-run-1",
  }));
  unitFindManyMock.mock.mockImplementation(async () => [
    {
      id: "unit-1",
      name: "Unit 1",
      parent: { name: "Parent 1" },
    },
  ]);
  participationFindManyMock.mock.mockImplementation(async () => []);
  employeeGroupByMock.mock.mockImplementation(async () => []);
  participationCreateMock.mock.mockImplementation(async () => ({
    id: "snapshot-1",
  }));
});

function input(participantCount: number) {
  return {
    categoryId: "category-1",
    tw: 1,
    year: 2026,
    rows: [{ unitId: "unit-1", participantCount }],
  };
}

describe("participation first snapshot", () => {
  it("freezes zero headcount with Decimal 0.00 and warning", async () => {
    const [result] = await createParticipationSnapshots(input(0));

    assert.equal(result.headcount, 0);
    assert.equal(result.warning, "ZERO_HEADCOUNT");
    assert.equal(result.percentage.toFixed(2), "0.00");
    assert.equal(result.employeeSyncRunId, "sync-run-1");
  });

  it("counts only direct active employees and calculates Decimal percentage", async () => {
    employeeGroupByMock.mock.mockImplementation(async () => [
      { unitId: "unit-1", _count: { _all: 4 } },
    ]);

    const [result] = await createParticipationSnapshots(input(1));

    assert.equal(result.headcount, 4);
    assert.equal(result.percentage.toFixed(2), "25.00");
    assert.deepEqual(employeeGroupByMock.mock.calls[0]!.arguments[0].where, {
      unitId: { in: ["unit-1"] },
      isPresentInSource: true,
      kodeStatpeg: "01",
      statKepeg: "02",
    });
  });

  it("rejects participant count above frozen headcount", async () => {
    employeeGroupByMock.mock.mockImplementation(async () => [
      { unitId: "unit-1", _count: { _all: 1 } },
    ]);

    await assert.rejects(
      createParticipationSnapshots(input(2)),
      (error: { status?: number }) => error.status === 400,
    );
    assert.equal(participationCreateMock.mock.callCount(), 0);
  });

  it("rejects an existing canonical snapshot key", async () => {
    participationFindManyMock.mock.mockImplementation(async () => [
      { unitId: "unit-1" },
    ]);

    await assert.rejects(
      createParticipationSnapshots(input(0)),
      (error: { status?: number }) => error.status === 409,
    );
    assert.equal(employeeGroupByMock.mock.callCount(), 0);
  });
});
