import { ApiError } from "@/lib/api/auth-guard";
import { Prisma } from "@generated/prisma";
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  assessParticipationScore,
  type AssessmentDatabase,
} from "./participation-assessment";

const approvedReport = {
  id: "report-1",
  unitId: "unit-1",
  status: "APPROVED",
  program: {
    tw: 1,
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    category: {
      id: "category-1",
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "PHOTO_WITHOUT_AI",
      scoreInputMode: "DIRECT_ADMIN",
    },
  },
};

type ExistingRow = {
  id: string;
  percentage: number | null;
  updatedAt: Date;
  evidenceReportId: string | null;
  importedAt: Date | null;
  importedById: string | null;
};

type SetupOptions = {
  existing?: ExistingRow | null;
  report?: typeof approvedReport | null;
  updateCount?: number;
  createError?: unknown;
  historyError?: unknown;
};

type WriteArgs = {
  data: Record<string, unknown>;
  select?: Record<string, boolean>;
  where?: Record<string, unknown>;
};

function directRow(overrides: Partial<ExistingRow> = {}): ExistingRow {
  return {
    id: "participation-1",
    percentage: 50,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    evidenceReportId: "report-1",
    importedAt: new Date("2026-08-30T00:00:00.000Z"),
    importedById: null,
    ...overrides,
  };
}

function expectApiError(status: number, message?: string) {
  return (error: unknown) =>
    error instanceof ApiError &&
    error.status === status &&
    (message === undefined || error.message === message);
}

function createAssessmentDatabase(options: SetupOptions = {}) {
  const existing = options.existing === undefined ? null : options.existing;
  const report = options.report === undefined ? approvedReport : options.report;
  const committedParticipationWrites: WriteArgs[] = [];
  const committedHistories: WriteArgs[] = [];
  let pendingParticipationWrites: WriteArgs[] = [];
  let pendingHistories: WriteArgs[] = [];

  const reportFindUniqueMock = mock.fn(async () => report);
  const lockMock = mock.fn(async (..._args: unknown[]) => []);
  const participationFindUniqueMock = mock.fn(async () => existing);
  const participationCreateMock = mock.fn(async (args: WriteArgs) => {
    if (options.createError !== undefined) throw options.createError;
    pendingParticipationWrites.push(args);
    return { id: "participation-1" };
  });
  const participationUpdateManyMock = mock.fn(async (args: WriteArgs) => {
    const count = options.updateCount ?? 1;
    if (count === 1) pendingParticipationWrites.push(args);
    return { count };
  });
  const historyCreateMock = mock.fn(async (args: WriteArgs) => {
    if (options.historyError !== undefined) throw options.historyError;
    pendingHistories.push(args);
    return { id: "history-1" };
  });

  const tx = {
    $queryRaw: lockMock,
    participationData: {
      findUnique: participationFindUniqueMock,
      create: participationCreateMock,
      updateMany: participationUpdateManyMock,
    },
    participationScoreHistory: { create: historyCreateMock },
  } as unknown as Prisma.TransactionClient;

  const transactionMock = mock.fn(
    async <T>(
      callback: (transaction: Prisma.TransactionClient) => Promise<T>,
    ) => {
      pendingParticipationWrites = [];
      pendingHistories = [];
      try {
        const result = await callback(tx);
        committedParticipationWrites.push(...pendingParticipationWrites);
        committedHistories.push(...pendingHistories);
        return result;
      } catch (error) {
        pendingParticipationWrites = [];
        pendingHistories = [];
        throw error;
      }
    },
  );

  const database = {
    activityReport: { findUnique: reportFindUniqueMock },
    $transaction: transactionMock,
  } as unknown as AssessmentDatabase;

  return {
    database,
    mocks: {
      reportFindUniqueMock,
      transactionMock,
      lockMock,
      participationFindUniqueMock,
      participationCreateMock,
      participationUpdateManyMock,
      historyCreateMock,
    },
    committedParticipationWrites,
    committedHistories,
  };
}

function input(
  percentage: number,
  overrides: {
    changeReason?: string;
    expectedUpdatedAt?: string;
  } = {},
) {
  return {
    reportId: "report-1",
    actorId: "admin-1",
    actorName: "Admin Satu",
    percentage,
    ...overrides,
  };
}

describe("assessParticipationScore", () => {
  it("creates score 0 and exactly one CREATED history atomically", async () => {
    const setup = createAssessmentDatabase();

    const result = await assessParticipationScore(input(0), setup.database);

    assert.deepEqual(result, {
      status: "CREATED",
      participationDataId: "participation-1",
      percentage: 0,
      historyId: "history-1",
    });
    assert.equal(setup.mocks.lockMock.mock.callCount(), 1);
    assert.equal(setup.mocks.participationCreateMock.mock.callCount(), 1);
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 0);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 1);
    assert.equal(setup.committedParticipationWrites.length, 1);
    assert.equal(setup.committedHistories.length, 1);

    const createArgs = setup.mocks.participationCreateMock.mock.calls[0]
      .arguments[0] as WriteArgs;
    assert.deepEqual(
      {
        unitId: createArgs.data.unitId,
        categoryId: createArgs.data.categoryId,
        tw: createArgs.data.tw,
        year: createArgs.data.year,
        percentage: createArgs.data.percentage,
        evidenceReportId: createArgs.data.evidenceReportId,
        assessedById: createArgs.data.assessedById,
      },
      {
        unitId: "unit-1",
        categoryId: "category-1",
        tw: 1,
        year: 2026,
        percentage: 0,
        evidenceReportId: "report-1",
        assessedById: "admin-1",
      },
    );
    assert.equal(createArgs.data.assessedAt instanceof Date, true);

    const historyArgs = setup.mocks.historyCreateMock.mock.calls[0]
      .arguments[0] as WriteArgs;
    assert.deepEqual(historyArgs.data, {
      participationDataId: "participation-1",
      evidenceReportId: "report-1",
      categoryId: "category-1",
      action: "CREATED",
      previousPercentage: null,
      newPercentage: 0,
      actorId: "admin-1",
      actorName: "Admin Satu",
    });
  });

  it("creates boundary score 100 without reason or version", async () => {
    const setup = createAssessmentDatabase();

    const result = await assessParticipationScore(input(100), setup.database);

    assert.equal(result.status, "CREATED");
    assert.equal(result.percentage, 100);
    assert.equal(setup.mocks.participationCreateMock.mock.callCount(), 1);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 1);
  });

  it("returns UNCHANGED before reason/version checks and performs no write", async () => {
    const setup = createAssessmentDatabase({
      existing: directRow({ percentage: 75 }),
    });

    const result = await assessParticipationScore(input(75), setup.database);

    assert.deepEqual(result, {
      status: "UNCHANGED",
      participationDataId: "participation-1",
      percentage: 75,
    });
    assert.equal(setup.mocks.participationCreateMock.mock.callCount(), 0);
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 0);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
    assert.deepEqual(setup.committedParticipationWrites, []);
    assert.deepEqual(setup.committedHistories, []);
  });

  it("updates with trimmed reason, displayed version, and one UPDATED history", async () => {
    const setup = createAssessmentDatabase({
      existing: directRow({ percentage: 50 }),
    });

    const result = await assessParticipationScore(
      input(80, {
        changeReason: "  Koreksi berdasarkan daftar peserta terbaru  ",
        expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
      }),
      setup.database,
    );

    assert.deepEqual(result, {
      status: "UPDATED",
      participationDataId: "participation-1",
      percentage: 80,
      historyId: "history-1",
    });
    assert.equal(setup.mocks.participationCreateMock.mock.callCount(), 0);
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 1);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 1);
    assert.equal(setup.committedParticipationWrites.length, 1);
    assert.equal(setup.committedHistories.length, 1);

    const updateArgs = setup.mocks.participationUpdateManyMock.mock.calls[0]
      .arguments[0] as WriteArgs;
    assert.deepEqual(updateArgs.where, {
      id: "participation-1",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    assert.equal(updateArgs.data.percentage, 80);
    assert.equal(updateArgs.data.assessedById, "admin-1");
    assert.equal(updateArgs.data.assessedAt instanceof Date, true);

    const historyArgs = setup.mocks.historyCreateMock.mock.calls[0]
      .arguments[0] as WriteArgs;
    assert.deepEqual(historyArgs.data, {
      participationDataId: "participation-1",
      evidenceReportId: "report-1",
      categoryId: "category-1",
      action: "UPDATED",
      previousPercentage: 50,
      newPercentage: 80,
      changeReason: "Koreksi berdasarkan daftar peserta terbaru",
      actorId: "admin-1",
      actorName: "Admin Satu",
    });
  });

  it("rejects a changed score without expectedUpdatedAt", async () => {
    const setup = createAssessmentDatabase({ existing: directRow() });

    await assert.rejects(
      assessParticipationScore(
        input(60, { changeReason: "Koreksi berdasarkan evaluasi terbaru" }),
        setup.database,
      ),
      expectApiError(400, "Versi data wajib dikirim saat mengubah nilai"),
    );
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 0);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
  });

  it("rejects a stale expectedUpdatedAt with 409 and no history", async () => {
    const setup = createAssessmentDatabase({
      existing: directRow(),
      updateCount: 0,
    });

    await assert.rejects(
      assessParticipationScore(
        input(60, {
          changeReason: "Koreksi berdasarkan evaluasi terbaru",
          expectedUpdatedAt: "2025-12-31T23:59:59.000Z",
        }),
        setup.database,
      ),
      expectApiError(409),
    );
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 1);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
    assert.deepEqual(setup.committedParticipationWrites, []);
    assert.deepEqual(setup.committedHistories, []);
  });

  for (const [label, changeReason] of [
    ["empty", ""],
    ["nine characters", "123456789"],
    ["501 characters", "x".repeat(501)],
  ] as const) {
    it(`rejects ${label} change reason`, async () => {
      const setup = createAssessmentDatabase({ existing: directRow() });

      await assert.rejects(
        assessParticipationScore(
          input(60, {
            changeReason,
            expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
          }),
          setup.database,
        ),
        expectApiError(400),
      );
      assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 0);
      assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
    });
  }

  for (const percentage of [-1, 101, 50.5, Number.NaN]) {
    it(`rejects invalid percentage ${String(percentage)}`, async () => {
      const setup = createAssessmentDatabase();

      await assert.rejects(
        assessParticipationScore(input(percentage), setup.database),
        expectApiError(400),
      );
      assert.equal(setup.mocks.reportFindUniqueMock.mock.callCount(), 0);
      assert.equal(setup.mocks.transactionMock.mock.callCount(), 0);
    });
  }

  it("returns 404 when report or its required relations are missing", async () => {
    const setup = createAssessmentDatabase({ report: null });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      expectApiError(404),
    );
    assert.equal(setup.mocks.transactionMock.mock.callCount(), 0);
  });

  it("rejects a report that is not APPROVED", async () => {
    const setup = createAssessmentDatabase({
      report: { ...approvedReport, status: "PENDING" },
    });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      expectApiError(409),
    );
    assert.equal(setup.mocks.transactionMock.mock.callCount(), 0);
  });

  it("rejects a non-direct capability tuple", async () => {
    const setup = createAssessmentDatabase({
      report: {
        ...approvedReport,
        program: {
          ...approvedReport.program,
          category: {
            ...approvedReport.program.category,
            targetUnit: "KEGIATAN",
            evidenceMode: "PHOTO_WITH_AI",
            scoreInputMode: "NONE",
          },
        },
      },
    });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      expectApiError(422),
    );
    assert.equal(setup.mocks.transactionMock.mock.callCount(), 0);
  });

  it("explicitly rejects the EXCEL_IMPORT capability before transaction", async () => {
    const setup = createAssessmentDatabase({
      report: {
        ...approvedReport,
        program: {
          ...approvedReport.program,
          category: {
            ...approvedReport.program.category,
            evidenceMode: "NONE",
            scoreInputMode: "EXCEL_IMPORT",
          },
        },
      },
    });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      expectApiError(
        422,
        "Kategori import Excel tidak mendukung penilaian langsung oleh admin",
      ),
    );
    assert.equal(setup.mocks.transactionMock.mock.callCount(), 0);
  });

  it("rejects an invalid TW instead of defaulting identity", async () => {
    const setup = createAssessmentDatabase({
      report: {
        ...approvedReport,
        program: { ...approvedReport.program, tw: 0 },
      },
    });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      expectApiError(422),
    );
    assert.equal(setup.mocks.transactionMock.mock.callCount(), 0);
  });

  it("rejects same-value Excel-origin data with 409 before idempotency", async () => {
    const setup = createAssessmentDatabase({
      existing: directRow({
        percentage: 50,
        importedById: "admin-importer",
      }),
    });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      expectApiError(409),
    );
    assert.equal(setup.mocks.participationCreateMock.mock.callCount(), 0);
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 0);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
    assert.deepEqual(setup.committedParticipationWrites, []);
    assert.deepEqual(setup.committedHistories, []);
  });

  it("rejects unknown provenance with 409 before idempotency", async () => {
    const setup = createAssessmentDatabase({
      existing: directRow({ percentage: 50, evidenceReportId: null }),
    });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      expectApiError(409),
    );
    assert.equal(setup.mocks.participationCreateMock.mock.callCount(), 0);
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 0);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
    assert.deepEqual(setup.committedParticipationWrites, []);
    assert.deepEqual(setup.committedHistories, []);
  });

  it("rejects a different evidence report with 409 before idempotency", async () => {
    const setup = createAssessmentDatabase({
      existing: directRow({ percentage: 50, evidenceReportId: "report-2" }),
    });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      expectApiError(409),
    );
    assert.equal(setup.mocks.participationCreateMock.mock.callCount(), 0);
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 0);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
    assert.deepEqual(setup.committedParticipationWrites, []);
    assert.deepEqual(setup.committedHistories, []);
  });

  it("allows same-report UNCHANGED with populated importedAt", async () => {
    const setup = createAssessmentDatabase({
      existing: directRow({
        percentage: 75,
        evidenceReportId: "report-1",
        importedAt: new Date("2026-08-30T00:00:00.000Z"),
      }),
    });

    const result = await assessParticipationScore(input(75), setup.database);

    assert.deepEqual(result, {
      status: "UNCHANGED",
      participationDataId: "participation-1",
      percentage: 75,
    });
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 0);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
  });

  it("allows same-report update with populated importedAt", async () => {
    const setup = createAssessmentDatabase({
      existing: directRow({
        percentage: 50,
        evidenceReportId: "report-1",
        importedAt: new Date("2026-08-30T00:00:00.000Z"),
      }),
    });

    const result = await assessParticipationScore(
      input(80, {
        changeReason: "Koreksi berdasarkan daftar peserta terbaru",
        expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
      }),
      setup.database,
    );

    assert.equal(result.status, "UPDATED");
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 1);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 1);
  });

  it("maps an initial unique race to 409 without creating history", async () => {
    const setup = createAssessmentDatabase({
      createError: { code: "P2002" },
    });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      expectApiError(409),
    );
    assert.equal(setup.mocks.participationCreateMock.mock.callCount(), 1);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
    assert.deepEqual(setup.committedParticipationWrites, []);
    assert.deepEqual(setup.committedHistories, []);
  });

  it("maps a changed-score conditional race to 409", async () => {
    const setup = createAssessmentDatabase({
      existing: directRow(),
      updateCount: 0,
    });

    await assert.rejects(
      assessParticipationScore(
        input(60, {
          changeReason: "Koreksi berdasarkan evaluasi terbaru",
          expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
        }),
        setup.database,
      ),
      expectApiError(409),
    );
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 0);
    assert.deepEqual(setup.committedParticipationWrites, []);
    assert.deepEqual(setup.committedHistories, []);
  });

  it("rolls back a created current score when CREATED history fails", async () => {
    const historyError = new Error("history create failed");
    const setup = createAssessmentDatabase({ historyError });

    await assert.rejects(
      assessParticipationScore(input(50), setup.database),
      historyError,
    );
    assert.equal(setup.mocks.participationCreateMock.mock.callCount(), 1);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 1);
    assert.deepEqual(setup.committedParticipationWrites, []);
    assert.deepEqual(setup.committedHistories, []);
  });

  it("rolls back a changed current score when UPDATED history fails", async () => {
    const historyError = new Error("history update failed");
    const setup = createAssessmentDatabase({
      existing: directRow(),
      historyError,
    });

    await assert.rejects(
      assessParticipationScore(
        input(60, {
          changeReason: "Koreksi berdasarkan evaluasi terbaru",
          expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
        }),
        setup.database,
      ),
      historyError,
    );
    assert.equal(setup.mocks.participationUpdateManyMock.mock.callCount(), 1);
    assert.equal(setup.mocks.historyCreateMock.mock.callCount(), 1);
    assert.deepEqual(setup.committedParticipationWrites, []);
    assert.deepEqual(setup.committedHistories, []);
  });
});
