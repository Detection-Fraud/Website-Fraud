import assert from "node:assert/strict";
import { mock, test } from "node:test";

type Fixture = {
  submitCounts: Array<{ createdById: string; _count: { id: number } }>;
  approvedCounts: Array<{ createdById: string; _count: { id: number } }>;
  approvedReports: Array<{
    createdById: string;
    updatedAt: Date;
    logs: Array<{ createdAt: Date }>;
  }>;
  users: Array<{
    id: string;
    name: string;
    unit: { name: string; type: string };
  }>;
};

const time = (value: string) => new Date(`2026-01-01T${value}.000Z`);

let fixture: Fixture;
let groupByCall = 0;

const groupByMock = mock.fn<(...args: any[]) => Promise<any>>(async () => {
  groupByCall += 1;
  return groupByCall === 1 ? fixture.submitCounts : fixture.approvedCounts;
});

const approvedReportsMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => fixture.approvedReports,
);

const usersMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => fixture.users,
);

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      activityReport: {
        groupBy: groupByMock,
        findMany: approvedReportsMock,
      },
      user: { findMany: usersMock },
    },
  },
});

let getRankingCC: typeof import("./get-ranking-cc").getRankingCC;
let getTargetCompletionAt: typeof import("./get-ranking-cc").getTargetCompletionAt;
let getApprovalTimesForReport: typeof import("./get-ranking-cc").getApprovalTimesForReport;
let sortRankingCC: typeof import("./get-ranking-cc").sortRankingCC;

test.before(async () => {
  ({
    getRankingCC,
    getTargetCompletionAt,
    getApprovalTimesForReport,
    sortRankingCC,
  } = await import("./get-ranking-cc"));
});

test.beforeEach(() => {
  fixture = {
    submitCounts: [],
    approvedCounts: [],
    approvedReports: [],
    users: [],
  };
  groupByCall = 0;
  groupByMock.mock.resetCalls();
  approvedReportsMock.mock.resetCalls();
  usersMock.mock.resetCalls();
});

function rankingItem(
  userId: string,
  values: Partial<{
    approvalRate: number;
    approved: number;
    submitted: number;
    reachedTarget: boolean;
    targetCompletionAt: Date | null;
    lastSubmittedAt: Date;
  }> = {},
) {
  return {
    userId,
    approvalRate: values.approvalRate ?? 0,
    approved: values.approved ?? 0,
    submitted: values.submitted ?? 1,
    reachedTarget: values.reachedTarget ?? false,
    targetCompletionAt: values.targetCompletionAt ?? null,
    lastSubmittedAt: values.lastSubmittedAt ?? time("00:00:00"),
  };
}

function configureSingleCC(input: {
  submitted: number;
  approved: number;
  target: number;
  logs?: string[];
  updatedAt?: string;
}) {
  fixture.submitCounts = [
    { createdById: "cc-a", _count: { id: input.submitted } },
  ];

  fixture.approvedCounts = [
    { createdById: "cc-a", _count: { id: input.approved } },
  ];

  fixture.approvedReports = input.approved
    ? [
        {
          createdById: "cc-a",
          updatedAt: time(input.updatedAt ?? "18:00:00"),
          logs: (input.logs ?? []).map((createdAt) => ({
            createdAt: time(createdAt),
          })),
        },
      ]
    : [];

  fixture.users = [
    {
      id: "cc-a",
      name: "CC A",
      unit: { name: "Unit A", type: "DIVISI" },
    },
  ];

  return getRankingCC({
    whereClause: { programId: { in: ["program-1"] } },
    year: 2026,
    programTarget: input.target,
    page: 1,
    limit: 10,
  });
}

test("target > 1 uses the Nth approval timestamp", () => {
  assert.equal(
    getTargetCompletionAt(
      [time("10:00:00"), time("12:00:00"), time("15:00:00")],
      2,
    )?.toISOString(),
    time("12:00:00").toISOString(),
  );
});

test("later approvals do not move an already reached target", () => {
  const approvalTimes = [time("10:00:00"), time("12:00:00"), time("15:00:00")];

  assert.equal(getTargetCompletionAt(approvalTimes, 2), approvalTimes[1]);
});

test("reached-target CCs use earlier target completion before count fallbacks", () => {
  const sorted = sortRankingCC([
    rankingItem("cc-late", {
      reachedTarget: true,
      targetCompletionAt: time("12:00:00"),
    }),
    rankingItem("cc-early", {
      reachedTarget: true,
      targetCompletionAt: time("10:00:00"),
    }),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.userId),
    ["cc-early", "cc-late"],
  );
});

test("over-achievement remains capped and in the same reached-target group", () => {
  const sorted = sortRankingCC([
    rankingItem("cc-over", {
      approvalRate: 100,
      approved: 6,
      reachedTarget: true,
      targetCompletionAt: time("12:00:00"),
    }),
    rankingItem("cc-exact", {
      approvalRate: 100,
      approved: 2,
      reachedTarget: true,
      targetCompletionAt: time("10:00:00"),
    }),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.userId),
    ["cc-exact", "cc-over"],
  );
});

test("getRankingCC caps over-achievement at 100%", async () => {
  const result = await configureSingleCC({
    submitted: 6,
    approved: 6,
    target: 5,
    logs: ["09:00:00"],
  });

  assert.equal(result.rankingCC[0]?.approvalRate, 100);
});

test("not-reached CCs compare approvalRate before approval time", () => {
  const sorted = sortRankingCC([
    rankingItem("cc-80", {
      approvalRate: 80,
      targetCompletionAt: time("10:00:00"),
    }),
    rankingItem("cc-90", {
      approvalRate: 90,
      targetCompletionAt: time("12:00:00"),
    }),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.userId),
    ["cc-90", "cc-80"],
  );
});

test("missing APPROVED log falls back to report.updatedAt", async () => {
  const updatedAt = time("09:00:00");

  assert.deepEqual(getApprovalTimesForReport([], updatedAt), [updatedAt]);

  const result = await configureSingleCC({
    submitted: 1,
    approved: 1,
    target: 1,
    updatedAt: "09:00:00",
  });

  assert.equal(result.rankingCC[0]?.userId, "cc-a");
  assert.equal(
    approvedReportsMock.mock.calls[0]?.arguments[0].select.updatedAt,
    true,
  );

  const logsSelection =
    approvedReportsMock.mock.calls[0]?.arguments[0].select.logs;

  assert.ok(logsSelection);
  assert.equal(logsSelection.take, 1);
  assert.deepEqual(logsSelection.orderBy, {
    createdAt: "desc",
  });
});

test("Nth approval controls integration ranking, not first or later approval", async () => {
  fixture.submitCounts = [
    { createdById: "cc-target", _count: { id: 2 } },
    { createdById: "cc-rival", _count: { id: 2 } },
  ];

  fixture.approvedCounts = [
    { createdById: "cc-target", _count: { id: 2 } },
    { createdById: "cc-rival", _count: { id: 2 } },
  ];

  fixture.approvedReports = [
    {
      createdById: "cc-target",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("10:00:00") }],
    },
    {
      createdById: "cc-target",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("12:00:00") }],
    },
    {
      createdById: "cc-target",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("15:00:00") }],
    },
    {
      createdById: "cc-rival",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("09:00:00") }],
    },
    {
      createdById: "cc-rival",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("12:30:00") }],
    },
  ];

  fixture.users = fixture.submitCounts.map(({ createdById }) => ({
    id: createdById,
    name: createdById,
    unit: { name: createdById, type: "DIVISI" },
  }));

  const result = await getRankingCC({
    whereClause: {},
    year: 2026,
    programTarget: 2,
    page: 1,
    limit: 10,
  });

  assert.deepEqual(
    result.rankingCC.map((item) => item.userId),
    ["cc-target", "cc-rival"],
  );
});

test("one report with repeated approvals contributes one approved timestamp", async () => {
  fixture.submitCounts = [
    { createdById: "cc-repeat", _count: { id: 1 } },
    { createdById: "cc-two", _count: { id: 2 } },
  ];

  fixture.approvedCounts = [
    { createdById: "cc-repeat", _count: { id: 1 } },
    { createdById: "cc-two", _count: { id: 2 } },
  ];

  fixture.approvedReports = [
    {
      createdById: "cc-repeat",
      updatedAt: time("18:00:00"),
      // One ActivityReport: approve, reject, resubmit, approve.
      logs: [{ createdAt: time("14:00:00") }, { createdAt: time("10:00:00") }],
    },
    {
      createdById: "cc-two",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("11:00:00") }],
    },
    {
      createdById: "cc-two",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("12:00:00") }],
    },
  ];

  fixture.users = fixture.submitCounts.map(({ createdById }) => ({
    id: createdById,
    name: createdById,
    unit: { name: createdById, type: "DIVISI" },
  }));

  const result = await getRankingCC({
    whereClause: {},
    year: 2026,
    programTarget: 2,
    page: 1,
    limit: 10,
  });

  assert.deepEqual(
    result.rankingCC.map((item) => item.userId),
    ["cc-two", "cc-repeat"],
  );
});

test("missing-log updatedAt fallback participates in completion ordering", async () => {
  fixture.submitCounts = [
    { createdById: "cc-fallback", _count: { id: 1 } },
    { createdById: "cc-logged", _count: { id: 1 } },
  ];

  fixture.approvedCounts = [
    { createdById: "cc-fallback", _count: { id: 1 } },
    { createdById: "cc-logged", _count: { id: 1 } },
  ];

  fixture.approvedReports = [
    {
      createdById: "cc-fallback",
      updatedAt: time("09:00:00"),
      logs: [],
    },
    {
      createdById: "cc-logged",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("10:00:00") }],
    },
  ];

  fixture.users = fixture.submitCounts.map(({ createdById }) => ({
    id: createdById,
    name: createdById,
    unit: { name: createdById, type: "DIVISI" },
  }));

  const result = await getRankingCC({
    whereClause: {},
    year: 2026,
    programTarget: 1,
    page: 1,
    limit: 10,
  });

  assert.deepEqual(
    result.rankingCC.map((item) => item.userId),
    ["cc-fallback", "cc-logged"],
  );
});

test("submitted count is report count, not resubmit log count", async () => {
  // One ActivityReport with SUBMITTED + RESUBMITTED history remains one record.
  const result = await configureSingleCC({
    submitted: 1,
    approved: 0,
    target: 1,
  });

  assert.equal(result.rankingCC[0]?.submitted, 1);

  const submitQuery = groupByMock.mock.calls[0]?.arguments[0];

  assert.deepEqual(submitQuery.by, ["createdById"]);
  assert.equal(submitQuery._count.id, true);
});

test("full ranking is sorted before pagination", async () => {
  fixture.submitCounts = [
    { createdById: "cc-late", _count: { id: 2 } },
    { createdById: "cc-early", _count: { id: 2 } },
    { createdById: "cc-unreached", _count: { id: 10 } },
  ];

  fixture.approvedCounts = [
    { createdById: "cc-late", _count: { id: 2 } },
    { createdById: "cc-early", _count: { id: 2 } },
    { createdById: "cc-unreached", _count: { id: 1 } },
  ];

  fixture.approvedReports = [
    {
      createdById: "cc-late",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("12:00:00") }, { createdAt: time("13:00:00") }],
    },
    {
      createdById: "cc-early",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("10:00:00") }, { createdAt: time("11:00:00") }],
    },
    {
      createdById: "cc-unreached",
      updatedAt: time("18:00:00"),
      logs: [{ createdAt: time("09:00:00") }],
    },
  ];

  fixture.users = fixture.submitCounts.map(({ createdById }) => ({
    id: createdById,
    name: createdById,
    unit: { name: createdById, type: "DIVISI" },
  }));

  const result = await getRankingCC({
    whereClause: {},
    year: 2026,
    programTarget: 2,
    page: 2,
    limit: 1,
  });

  assert.deepEqual(
    result.rankingCC.map((item) => [item.rank, item.userId]),
    [[2, "cc-late"]],
  );
});

test("lastSubmittedAt does not affect CC ranking comparator", () => {
  const sorted = sortRankingCC([
    rankingItem("cc-b", {
      reachedTarget: true,
      targetCompletionAt: time("10:00:00"),
      lastSubmittedAt: time("08:00:00"),
    }),
    rankingItem("cc-a", {
      reachedTarget: true,
      targetCompletionAt: time("10:00:00"),
      lastSubmittedAt: time("20:00:00"),
    }),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.userId),
    ["cc-a", "cc-b"],
  );
});

test("approval history query is scoped to APPROVED logs, not submission history", async () => {
  await configureSingleCC({
    submitted: 1,
    approved: 1,
    target: 1,
    logs: ["10:00:00"],
  });

  const approvedQuery = approvedReportsMock.mock.calls[0]?.arguments[0];

  assert.deepEqual(approvedQuery.where.AND[1], {
    status: "APPROVED",
    createdById: { in: ["cc-a"] },
  });

  assert.deepEqual(approvedQuery.select.logs.where, {
    action: "APPROVED",
  });

  assert.deepEqual(approvedQuery.select.logs.orderBy, {
    createdAt: "desc",
  });

  assert.equal("lastSubmittedAt" in approvedQuery.select, false);
});

test("all metric ties use userId ASC", () => {
  const sorted = sortRankingCC([rankingItem("cc-z"), rankingItem("cc-a")]);

  assert.deepEqual(
    sorted.map((item) => item.userId),
    ["cc-a", "cc-z"],
  );
});
