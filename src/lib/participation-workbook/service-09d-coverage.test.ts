import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { Prisma } from "@generated/prisma/client";
import {
  generateParticipationWorkbook,
  loadParticipationWorkbook,
  parseParticipationWorkbook,
  serializeParticipationWorkbook,
  validateParticipationWorkbookStructure,
} from "./index";

const categoryFindUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({
  name: "Partisipasi",
  targetUnit: "PARTISIPASI_PERSEN",
  evidenceMode: "NONE",
  scoreInputMode: "EXCEL_IMPORT",
}));
const unitFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(async () => []);
const employeeGroupByMock = mock.fn<(...args: any[]) => Promise<any>>(async () => []);
const participationFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(async () => []);
const transactionMock = mock.fn<(...args: any[]) => Promise<any>>(async (callback: (tx: unknown) => Promise<unknown>) => callback({
  $queryRaw: async () => [{
    targetUnit: "PARTISIPASI_PERSEN",
    evidenceMode: "NONE",
    scoreInputMode: "EXCEL_IMPORT",
  }],
}));
const createSnapshotsMock = mock.fn<(...args: any[]) => Promise<any>>(async () => []);
const correctSnapshotsMock = mock.fn<(...args: any[]) => Promise<any>>(async () => []);

mock.module("@/lib/prisma", { namedExports: { prisma: {
  programCategory: { findUnique: categoryFindUniqueMock },
  unit: { findMany: unitFindManyMock },
  employee: { groupBy: employeeGroupByMock },
  participationData: { findMany: participationFindManyMock },
  $transaction: transactionMock,
} } });
mock.module("@/lib/participation-snapshot", { namedExports: { createParticipationSnapshotsInTransaction: createSnapshotsMock } });
mock.module("@/lib/participation-correction", { namedExports: { correctParticipationSnapshotsInTransaction: correctSnapshotsMock } });
mock.module("@/lib/api/auth-guard", { namedExports: { ApiError: class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
} } });

let buildParticipationTemplate: typeof import("./service")["buildParticipationTemplate"];
let buildParticipationExport: typeof import("./service")["buildParticipationExport"];
let commitParticipationWorkbook: typeof import("./service")["commitParticipationWorkbook"];
let previewParticipationWorkbook: typeof import("./service")["previewParticipationWorkbook"];

before(async () => {
  ({ buildParticipationTemplate, buildParticipationExport, commitParticipationWorkbook, previewParticipationWorkbook } = await import("./service"));
});

const categoryId = "22222222-2222-4222-8222-222222222222";
const firstUnitId = "11111111-1111-4111-8111-111111111111";
const correctionUnitId = "33333333-3333-4333-8333-333333333333";
const unchangedUnitId = "44444444-4444-4444-8444-444444444444";
const zeroUnitId = "55555555-5555-4555-8555-555555555555";
const bulogUnitId = "66666666-6666-4666-8666-666666666666";
const updatedAt = new Date("2026-09-02T00:00:00.000Z");

const workbookCodeBySourceCode: Record<string, string> = {
  "U-FIRST": "DIVISI:U-FIRST",
  "U-CORRECTION": "WILAYAH:01:01",
  "U-UNCHANGED": "WILAYAH:09:00",
  "U-ZERO": "DIVISI:U-ZERO",
};

function workbookCode(unitCode: string) {
  return workbookCodeBySourceCode[unitCode] ?? unitCode;
}

function units() { return [
  { id: firstUnitId, kodeOrg: "U-FIRST", kodeDolog: "00", kodeSubdolog: "00", name: "Unit First", type: "DIVISI" as const, parent: { name: "Parent First" } },
  { id: correctionUnitId, kodeOrg: "U-CORRECTION", kodeDolog: "01", kodeSubdolog: "01", name: "Unit Correction", type: "KANTOR_CABANG" as const, parent: { name: "Parent Correction" } },
  { id: unchangedUnitId, kodeOrg: "U-UNCHANGED", kodeDolog: "09", kodeSubdolog: "00", name: "Unit Unchanged", type: "KANTOR_WILAYAH" as const, parent: { name: "Parent Unchanged" } },
  { id: zeroUnitId, kodeOrg: "U-ZERO", kodeDolog: "00", kodeSubdolog: "00", name: "Unit Zero", type: "DIVISI" as const, parent: null },
]; }

function row(unitCode: string, participantCount: number | null, overrides: Record<string, unknown> = {}) {
  return { unitCode: workbookCode(unitCode), unitName: "Workbook label", parentUnitName: "Workbook parent", headcount: 9999, participantCount, percentage: 99.99, ...overrides };
}

async function workbookBuffer(
  rows: ReturnType<typeof row>[],
  divisi: ReturnType<typeof row>[] = [],
) {
  const workbook = generateParticipationWorkbook({ summary: rows, kanwil: [], kancab: [], divisi });
  return Buffer.from(new Uint8Array(await serializeParticipationWorkbook(workbook)));
}

function existingRows() { return [
  { id: "participation-correction", unitId: correctionUnitId, headcount: 10, participantCount: 3, percentage: new Prisma.Decimal("30.00"), provenance: "EMPLOYEE_SNAPSHOT", employeeSyncRunId: "sync-correction", headcountCapturedAt: new Date("2026-09-01T00:00:00.000Z"), unitNameSnapshot: "Historical Correction Name", parentUnitNameSnapshot: "Historical Correction Parent", categoryNameSnapshot: "Historical Category", updatedAt },
  { id: "participation-unchanged", unitId: unchangedUnitId, headcount: 10, participantCount: 5, percentage: new Prisma.Decimal("50.00"), provenance: "EMPLOYEE_SNAPSHOT", employeeSyncRunId: "sync-unchanged", headcountCapturedAt: new Date("2026-09-01T00:00:00.000Z"), unitNameSnapshot: "Historical Unchanged Name", parentUnitNameSnapshot: "Historical Unchanged Parent", categoryNameSnapshot: "Historical Category", updatedAt },
  { id: "participation-zero", unitId: zeroUnitId, headcount: 0, participantCount: 0, percentage: new Prisma.Decimal("0.00"), provenance: "EMPLOYEE_SNAPSHOT", employeeSyncRunId: "sync-zero", headcountCapturedAt: new Date("2026-09-01T00:00:00.000Z"), unitNameSnapshot: "Historical Zero Name", parentUnitNameSnapshot: null, categoryNameSnapshot: "Historical Category", updatedAt },
]; }

beforeEach(() => {
  categoryFindUniqueMock.mock.resetCalls(); unitFindManyMock.mock.resetCalls(); employeeGroupByMock.mock.resetCalls(); participationFindManyMock.mock.resetCalls(); transactionMock.mock.resetCalls(); createSnapshotsMock.mock.resetCalls(); correctSnapshotsMock.mock.resetCalls();
  unitFindManyMock.mock.mockImplementation(async () => units());
  employeeGroupByMock.mock.mockImplementation(async () => [
    { unitId: firstUnitId, _count: { _all: 4 } }, { unitId: correctionUnitId, _count: { _all: 10 } }, { unitId: unchangedUnitId, _count: { _all: 10 } }, { unitId: zeroUnitId, _count: { _all: 0 } },
  ]);
  participationFindManyMock.mock.mockImplementation(async () => []);
  transactionMock.mock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
    $queryRaw: async () => [{
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "NONE",
      scoreInputMode: "EXCEL_IMPORT",
    }],
  }));
  createSnapshotsMock.mock.mockImplementation(async () => [{ unitId: firstUnitId, participantCount: 2, percentage: new Prisma.Decimal("50.00"), warning: null }]);
  correctSnapshotsMock.mock.mockImplementation(async () => [{ unitId: correctionUnitId, participantCount: 4, percentage: new Prisma.Decimal("40.00"), warning: null, status: "UPDATED", auditId: "audit-correction" }]);
});

describe("Task 09D participation workbook service", () => {
  it("builds a template for regional Units that share kodeOrg", async () => {
    unitFindManyMock.mock.mockImplementationOnce(async () => [
      { ...units()[2], id: "kanwil-09", kodeOrg: "E0B000", kodeDolog: "09" },
      { ...units()[2], id: "kanwil-10", kodeOrg: "E0B000", kodeDolog: "10" },
    ]);
    employeeGroupByMock.mock.mockImplementationOnce(async () => [
      { unitId: "kanwil-09", _count: { _all: 3 } },
      { unitId: "kanwil-10", _count: { _all: 4 } },
    ]);

    const parsed = parseParticipationWorkbook(
      await loadParticipationWorkbook(
        await buildParticipationTemplate({ categoryId, tw: 1, year: 2026 }),
      ),
    );

    assert.deepEqual(
      parsed.sheets.summary.map((item) => item.unitCode),
      ["WILAYAH:09:00", "WILAYAH:10:00"],
    );
  });

  it("excludes canonical DIVISI:E00 from template rows and headcounts by identity", async () => {
    const templateUnits = [
      ...units(),
      { id: bulogUnitId, kodeOrg: "E00", kodeDolog: "00", kodeSubdolog: "00", name: "Renamed executive", type: "DIVISI" as const, parent: null },
      { id: "name-only-bulog", kodeOrg: "U-BULOG", kodeDolog: "00", kodeSubdolog: "00", name: "PERUM BULOG", type: "DIVISI" as const, parent: null },
    ];
    unitFindManyMock.mock.mockImplementationOnce(async () => templateUnits);

    const workbook = await loadParticipationWorkbook(
      await buildParticipationTemplate({ categoryId, tw: 1, year: 2026 }),
    );
    const parsed = parseParticipationWorkbook(workbook);

    assert.equal(parsed.sheets.summary.some((item) => item.unitCode === "DIVISI:E00"), false);
    assert.equal(parsed.sheets.divisi.some((item) => item.unitCode === "DIVISI:E00"), false);
    assert.equal(parsed.sheets.summary.some((item) => item.unitCode === "DIVISI:U-BULOG"), true);
    assert.equal(parsed.sheets.divisi.some((item) => item.unitCode === "DIVISI:U-BULOG"), true);
    assert.deepEqual(
      Array.from({ length: parsed.sheets.summary.length }, (_, index) =>
        workbook.getWorksheet("Summary")!.getCell(index + 2, 1).value,
      ),
      Array.from({ length: parsed.sheets.summary.length }, (_, index) => index + 1),
    );
    assert.deepEqual(
      Array.from({ length: parsed.sheets.divisi.length }, (_, index) =>
        workbook.getWorksheet("Divisi")!.getCell(index + 2, 1).value,
      ),
      Array.from({ length: parsed.sheets.divisi.length }, (_, index) => index + 1),
    );
    assert.equal(
      employeeGroupByMock.mock.calls[0]?.arguments[0].where.unitId.in.includes(bulogUnitId),
      false,
    );
  });

  it("previews canonical and unique legacy E00 rows as the explicit excluded-unit error", async () => {
    for (const sourceCode of ["DIVISI:E00", "E00"]) {
      unitFindManyMock.mock.mockImplementationOnce(async () => [
        ...units(),
        { id: bulogUnitId, kodeOrg: "E00", kodeDolog: "00", kodeSubdolog: "00", name: "Renamed executive", type: "DIVISI" as const, parent: null },
      ]);

      const result = await previewParticipationWorkbook({
        buffer: await workbookBuffer([row(sourceCode, sourceCode === "E00" ? null : 1)]),
        categoryId,
        tw: 1,
        year: 2026,
      });

      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0]?.status, "ERROR");
      assert.equal(result.rows[0]?.unitCode, "DIVISI:E00");
      assert.equal(result.rows[0]?.errorMsg, "PERUM BULOG tidak termasuk cakupan partisipasi");
      assert.equal(employeeGroupByMock.mock.calls.at(-1)?.arguments[0].where.unitId.in.includes(bulogUnitId), false);
    }
  });

  it("reports one explicit E00 error before reconciling conflicting cross-sheet rows", async () => {
    unitFindManyMock.mock.mockImplementationOnce(async () => [
      ...units(),
      { id: bulogUnitId, kodeOrg: "E00", kodeDolog: "00", kodeSubdolog: "00", name: "PERUM BULOG", type: "DIVISI" as const, parent: null },
    ]);

    const result = await previewParticipationWorkbook({
      buffer: await workbookBuffer([row("DIVISI:E00", 1)], [row("DIVISI:E00", 2)]),
      categoryId,
      tw: 1,
      year: 2026,
    });

    assert.equal(result.rows.length, 1);
    assert.equal(result.stats.error, 1);
    assert.equal(result.rows[0]?.unitCode, "DIVISI:E00");
    assert.equal(result.rows[0]?.errorMsg, "PERUM BULOG tidak termasuk cakupan partisipasi");
  });

  it("keeps same-sheet duplicate-code rejection ahead of excluded-unit preview", async () => {
    const beforeUnitRead = unitFindManyMock.mock.callCount();

    await assert.rejects(
      previewParticipationWorkbook({
        buffer: await workbookBuffer([row("DIVISI:E00", 1), row("DIVISI:E00", 2)]),
        categoryId,
        tw: 1,
        year: 2026,
      }),
      (error: { status?: number; message?: string }) =>
        error.status === 400 && /duplikat dalam sheet Summary/i.test(error.message ?? ""),
    );
    assert.equal(unitFindManyMock.mock.callCount(), beforeUnitRead);
  });

  it("rejects a manually supplied E00 row before commit mutations", async () => {
    unitFindManyMock.mock.mockImplementationOnce(async () => [
      ...units(),
      { id: bulogUnitId, kodeOrg: "E00", kodeDolog: "00", kodeSubdolog: "00", name: "PERUM BULOG", type: "DIVISI" as const, parent: null },
    ]);

    await assert.rejects(
      commitParticipationWorkbook({
        buffer: await workbookBuffer([row("DIVISI:E00", 1)]),
        categoryId,
        tw: 1,
        year: 2026,
        actorId: "admin-1",
        actorName: "Admin Test",
        corrections: [],
      }),
      (error: { status?: number; message?: string }) =>
        error.status === 400 && error.message?.includes("PERUM BULOG tidak termasuk cakupan partisipasi"),
    );

    assert.equal(transactionMock.mock.callCount(), 0);
    assert.equal(createSnapshotsMock.mock.callCount(), 0);
    assert.equal(correctSnapshotsMock.mock.callCount(), 0);
  });

  it("continues to accept a legacy kodeOrg when it identifies one Unit", async () => {
    const result = await previewParticipationWorkbook({
      buffer: await workbookBuffer([
        row("U-FIRST", 2, { unitCode: "U-FIRST" }),
      ]),
      categoryId,
      tw: 1,
      year: 2026,
    });

    assert.equal(result.rows[0]?.unitCode, "DIVISI:U-FIRST");
    assert.equal(result.rows[0]?.status, "FIRST");
  });

  it("rejects preview for a category outside the Excel-import capability", async () => {
    categoryFindUniqueMock.mock.mockImplementationOnce(async () => ({
      name: "Direct Admin",
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "PHOTO_WITHOUT_AI",
      scoreInputMode: "DIRECT_ADMIN",
    }));

    await assert.rejects(
      previewParticipationWorkbook({
        buffer: await workbookBuffer([row("U-FIRST", 2)]),
        categoryId,
        tw: 1,
        year: 2026,
      }),
      (error: { status?: number; message?: string }) =>
        error.status === 422 &&
        error.message === "Kategori tidak tersedia untuk import Excel",
    );
    assert.equal(unitFindManyMock.mock.callCount(), 0);
    assert.equal(participationFindManyMock.mock.callCount(), 0);
  });

  it("rejects commit for a category outside the Excel-import capability", async () => {
    categoryFindUniqueMock.mock.mockImplementationOnce(async () => ({
      name: "Kegiatan",
      targetUnit: "KEGIATAN",
      evidenceMode: "PHOTO_WITH_AI",
      scoreInputMode: "NONE",
    }));

    await assert.rejects(
      commitParticipationWorkbook({
        buffer: await workbookBuffer([row("U-FIRST", 2)]),
        categoryId,
        tw: 1,
        year: 2026,
        actorId: "admin-1",
        actorName: "Admin Test",
        corrections: [],
      }),
      (error: { status?: number; message?: string }) =>
        error.status === 422 &&
        error.message === "Kategori tidak tersedia untuk import Excel",
    );
    assert.equal(unitFindManyMock.mock.callCount(), 0);
    assert.equal(transactionMock.mock.callCount(), 0);
  });

  it("classifies preview rows, exposes expectedUpdatedAt, and remains read-only", async () => {
    participationFindManyMock.mock.mockImplementation(async () => existingRows());
    const result = await previewParticipationWorkbook({ buffer: await workbookBuffer([row("U-FIRST", 2), row("U-CORRECTION", 4), row("U-UNCHANGED", 5), row("U-ZERO", 0)]), categoryId, tw: 1, year: 2026 });
    assert.deepEqual(result.rows.map((item) => [item.unitCode, item.status]), [["DIVISI:U-FIRST", "FIRST"], ["DIVISI:U-ZERO", "UNCHANGED"], ["WILAYAH:01:01", "CORRECTION"], ["WILAYAH:09:00", "UNCHANGED"]]);
    assert.equal(result.rows.find((item) => item.unitCode === "WILAYAH:01:01")?.expectedUpdatedAt, updatedAt.toISOString());
    assert.equal(result.rows.find((item) => item.unitCode === "DIVISI:U-ZERO")?.warning, "ZERO_HEADCOUNT");
    assert.equal(result.rows.find((item) => item.unitCode === "DIVISI:U-ZERO")?.percentage, 0);
    assert.equal(result.rows.find((item) => item.unitCode === "DIVISI:U-ZERO")?.existingPercentage, 0);
    assert.equal(transactionMock.mock.callCount(), 0);
  });

  it("treats a unit with no matching employees as zero headcount", async () => {
    employeeGroupByMock.mock.mockImplementationOnce(async () => []);

    const result = await previewParticipationWorkbook({
      buffer: await workbookBuffer([row("U-FIRST", 0)]),
      categoryId,
      tw: 1,
      year: 2026,
    });

    assert.equal(result.rows[0]?.status, "FIRST");
    assert.equal(result.rows[0]?.headcount, 0);
    assert.equal(result.rows[0]?.percentage, 0);
    assert.equal(result.rows[0]?.warning, "ZERO_HEADCOUNT");
  });

  it("uses only Kode Unit and Jumlah Partisipasi as import authority", async () => {
    const result = await previewParticipationWorkbook({ buffer: await workbookBuffer([row("U-FIRST", 2, { unitName: "Forged", parentUnitName: "Forged Parent", headcount: 9999, percentage: 0.01 })]), categoryId, tw: 1, year: 2026 });
    const preview = result.rows[0];
    assert.equal(preview?.unitCode, "DIVISI:U-FIRST"); assert.equal(preview?.participantCount, 2); assert.equal(preview?.headcount, 4); assert.equal(preview?.percentage, 50); assert.equal(preview?.unitName, "Unit First");
  });

  it("counts unknown and invalid rows as ERROR", async () => {
    const result = await previewParticipationWorkbook({ buffer: await workbookBuffer([row("U-UNKNOWN", 2), row("U-FIRST", 5)]), categoryId, tw: 1, year: 2026 });
    assert.equal(result.stats.error, 2); assert.equal(result.rows.every((item) => item.status === "ERROR"), true); assert.ok(result.rows.some((item) => item.errorMsg?.includes("Kode Unit tidak ditemukan"))); assert.ok(result.rows.some((item) => item.errorMsg?.includes("Jumlah Partisipasi")));
  });

  it("requires matching expectedUpdatedAt and rejects stale corrections before mutation", async () => {
    participationFindManyMock.mock.mockImplementation(async () => existingRows());
    const input = { buffer: await workbookBuffer([row("U-CORRECTION", 4)]), categoryId, tw: 1, year: 2026, actorId: "admin-1", actorName: "Admin Test" };
    await assert.rejects(commitParticipationWorkbook({ ...input, corrections: [] }), (error: { status?: number }) => error.status === 400);
    await assert.rejects(commitParticipationWorkbook({ ...input, corrections: [{ unitCode: "WILAYAH:01:01", overwrite: true, reason: "Verified", expectedUpdatedAt: "2026-09-01T00:00:00.000Z" }] }), (error: { status?: number }) => error.status === 409);
    assert.equal(transactionMock.mock.callCount(), 0); assert.equal(createSnapshotsMock.mock.callCount(), 0); assert.equal(correctSnapshotsMock.mock.callCount(), 0);
  });

  it("rejects EMPTY rows before any workbook commit can partially proceed", async () => {
    await assert.rejects(
      commitParticipationWorkbook({
        buffer: await workbookBuffer([row("U-FIRST", 2), row("U-CORRECTION", null)]),
        categoryId,
        tw: 1,
        year: 2026,
        actorId: "admin-1",
        actorName: "Admin Test",
        corrections: [],
      }),
      (error: { status?: number; message?: string }) =>
        error.status === 400 &&
        error.message?.includes("WILAYAH:01:01") === true &&
        error.message.includes("wajib diisi"),
    );

    assert.equal(transactionMock.mock.callCount(), 0);
    assert.equal(createSnapshotsMock.mock.callCount(), 0);
    assert.equal(correctSnapshotsMock.mock.callCount(), 0);
  });

  it("uses one Serializable transaction for mixed FIRST/CORRECTION/UNCHANGED commit", async () => {
    participationFindManyMock.mock.mockImplementation(async () => existingRows());
    const result = await commitParticipationWorkbook({ buffer: await workbookBuffer([row("U-CORRECTION", 4), row("U-FIRST", 2), row("U-UNCHANGED", 5), row("U-ZERO", 0)]), categoryId, tw: 1, year: 2026, actorId: "admin-1", actorName: "Admin Test", corrections: [{ unitCode: "WILAYAH:01:01", overwrite: true, reason: "Verified", expectedUpdatedAt: updatedAt.toISOString() }] });
    assert.equal(transactionMock.mock.callCount(), 1); assert.deepEqual(transactionMock.mock.calls[0]?.arguments[1], { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); assert.equal(createSnapshotsMock.mock.callCount(), 1); assert.equal(correctSnapshotsMock.mock.callCount(), 1); assert.equal(result.skipped, 2);
  });

  it("rechecks and locks the exact Excel-import capability inside the commit transaction", async () => {
    const events: string[] = [];
    transactionMock.mock.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: async () => {
        events.push("category");
        return [{ targetUnit: "PARTISIPASI_PERSEN", evidenceMode: "NONE", scoreInputMode: "EXCEL_IMPORT" }];
      },
    }));
    createSnapshotsMock.mock.mockImplementationOnce(async () => {
      events.push("snapshot");
      return [{ unitId: firstUnitId, participantCount: 2, percentage: new Prisma.Decimal("50.00"), warning: null }];
    });

    await commitParticipationWorkbook({
      buffer: await workbookBuffer([row("U-FIRST", 2)]),
      categoryId,
      tw: 1,
      year: 2026,
      actorId: "admin-1",
      actorName: "Admin Test",
      corrections: [],
    });

    assert.deepEqual(events, ["category", "snapshot"]);
  });

  it("rejects a changed Excel-import capability before Task 7/8 writes", async () => {
    const writes: string[] = [];
    transactionMock.mock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: async () => [{ targetUnit: "PARTISIPASI_PERSEN", evidenceMode: "PHOTO_WITHOUT_AI", scoreInputMode: "DIRECT_ADMIN" }],
    }));
    createSnapshotsMock.mock.mockImplementation(async () => {
      writes.push("snapshot");
      return [];
    });
    correctSnapshotsMock.mock.mockImplementation(async () => {
      writes.push("correction");
      return [];
    });

    await assert.rejects(
      commitParticipationWorkbook({
        buffer: await workbookBuffer([row("U-FIRST", 2)]),
        categoryId,
        tw: 1,
        year: 2026,
        actorId: "admin-1",
        actorName: "Admin Test",
        corrections: [],
      }),
      (error: { status?: number; message?: string }) =>
        error.status === 422 && error.message === "Kategori tidak tersedia untuk import Excel",
    );
    assert.deepEqual(writes, []);
  });

  it("rolls back mixed work when the correction stage fails", async () => {
    participationFindManyMock.mock.mockImplementation(async () => existingRows());
    const committedState: string[] = [];

    transactionMock.mock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const stateBefore = [...committedState];
      try {
        return await callback({
          $queryRaw: async () => [{
            targetUnit: "PARTISIPASI_PERSEN",
            evidenceMode: "NONE",
            scoreInputMode: "EXCEL_IMPORT",
          }],
        });
      } catch (error) {
        committedState.splice(0, committedState.length, ...stateBefore);
        throw error;
      }
    });
    createSnapshotsMock.mock.mockImplementation(async () => {
      committedState.push("FIRST");
      return [{ unitId: firstUnitId, participantCount: 2, percentage: new Prisma.Decimal("50.00"), warning: null }];
    });
    correctSnapshotsMock.mock.mockImplementation(async () => {
      committedState.push("CORRECTION");
      throw new Error("correction failure");
    });

    await assert.rejects(
      commitParticipationWorkbook({
        buffer: await workbookBuffer([row("U-CORRECTION", 4), row("U-FIRST", 2)]),
        categoryId,
        tw: 1,
        year: 2026,
        actorId: "admin-1",
        actorName: "Admin Test",
        corrections: [{ unitCode: "WILAYAH:01:01", overwrite: true, reason: "Verified", expectedUpdatedAt: updatedAt.toISOString() }],
      }),
      /correction failure/,
    );

    assert.deepEqual(committedState, []);
  });

  it("exports frozen fields and rejects incomplete frozen provenance", async () => {
    participationFindManyMock.mock.mockImplementationOnce(async () => [{ unitId: correctionUnitId, headcount: 10, participantCount: 4, percentage: new Prisma.Decimal("40.00"), provenance: "EMPLOYEE_SNAPSHOT", employeeSyncRunId: "sync-correction", headcountCapturedAt: new Date("2026-09-01T00:00:00.000Z"), unitNameSnapshot: "Historical Name", parentUnitNameSnapshot: "Historical Parent", categoryNameSnapshot: "Historical Category", unit: { kodeOrg: "U-CORRECTION", kodeDolog: "01", kodeSubdolog: "01", type: "KANTOR_CABANG" } }]);
    const parsed = parseParticipationWorkbook(await loadParticipationWorkbook(await buildParticipationExport({ categoryId, tw: 1, year: 2026 })));
    assert.equal(parsed.sheets.summary[0]?.unitName, "Historical Name"); assert.equal(parsed.sheets.summary[0]?.headcount, 10); assert.equal(parsed.sheets.summary[0]?.participantCount, 4); assert.equal(parsed.sheets.summary[0]?.percentage, 40);
    participationFindManyMock.mock.mockImplementationOnce(async () => [
      { unitId: "historical-bulog", headcount: null, participantCount: null, percentage: null, provenance: "LEGACY", employeeSyncRunId: null, headcountCapturedAt: null, unitNameSnapshot: null, parentUnitNameSnapshot: null, categoryNameSnapshot: null, unit: { kodeOrg: "E00", kodeDolog: "00", kodeSubdolog: "00", type: "DIVISI" } },
      { unitId: correctionUnitId, headcount: 10, participantCount: 4, percentage: new Prisma.Decimal("40.00"), provenance: "EMPLOYEE_SNAPSHOT", employeeSyncRunId: "sync-correction", headcountCapturedAt: new Date("2026-09-01T00:00:00.000Z"), unitNameSnapshot: "Historical Name", parentUnitNameSnapshot: "Historical Parent", categoryNameSnapshot: "Historical Category", unit: { kodeOrg: "U-CORRECTION", kodeDolog: "01", kodeSubdolog: "01", type: "KANTOR_CABANG" } },
    ]);
    const exportWithHistoricalBulog = parseParticipationWorkbook(
      await loadParticipationWorkbook(
        await buildParticipationExport({ categoryId, tw: 1, year: 2026 }),
      ),
    );
    assert.deepEqual(
      exportWithHistoricalBulog.sheets.summary.map((item) => item.unitCode),
      ["WILAYAH:01:01"],
    );
    assert.equal(exportWithHistoricalBulog.sheets.divisi.length, 0);
    participationFindManyMock.mock.mockImplementationOnce(async () => [{ unitId: correctionUnitId, headcount: 10, participantCount: 4, percentage: new Prisma.Decimal("40.00"), provenance: "EMPLOYEE_SNAPSHOT", employeeSyncRunId: null, headcountCapturedAt: new Date("2026-09-01T00:00:00.000Z"), unitNameSnapshot: "Historical Name", parentUnitNameSnapshot: null, categoryNameSnapshot: "Historical Category", unit: { kodeOrg: "U-CORRECTION", kodeDolog: "01", kodeSubdolog: "01", type: "KANTOR_CABANG" } }]);
    await assert.rejects(buildParticipationExport({ categoryId, tw: 1, year: 2026 }), (error: { status?: number }) => error.status === 409);
  });

  it("fails closed on duplicate canonical codes through preview", async () => {
    unitFindManyMock.mock.mockImplementationOnce(async () => [{ ...units()[0], id: "duplicate-1", kodeOrg: "U-DUP" }, { ...units()[1], id: "duplicate-2", kodeOrg: " U-DUP ", type: "DIVISI", kodeDolog: "00", kodeSubdolog: "00" }]);
    employeeGroupByMock.mock.mockImplementationOnce(async () => [{ unitId: "duplicate-1", _count: { _all: 3 } }, { unitId: "duplicate-2", _count: { _all: 4 } }]);
    await assert.rejects(
      previewParticipationWorkbook({ buffer: await workbookBuffer([row("U-DUP", 1)]), categoryId, tw: 1, year: 2026 }),
      (error: { status?: number; message?: string }) =>
        error.status === 409 && /duplikat|ambigu/i.test(error.message ?? ""),
    );
  });

  it("rejects a shifted named table and ignores data outside its canonical boundary", async () => {
    const workbook = generateParticipationWorkbook({
      summary: [row("ATTACKER-UNIT", 99)],
      kanwil: [],
      kancab: [],
      divisi: [],
    });
    const worksheet = workbook.getWorksheet("Summary")!;
    const table = worksheet.getTable("SummaryTable")!;
    table.ref = "I1:O2";
    table.commit();
    [1, "ATTACKER-UNIT", "Attacker unit", "Attacker parent", 9999, 99, 1].forEach(
      (value, index) => {
        worksheet.getCell(2, index + 1).value = value;
      },
    );

    const structuralValidation = validateParticipationWorkbookStructure(workbook);
    assert.equal(structuralValidation.valid, false);
    await assert.rejects(
      Promise.resolve().then(async () =>
        parseParticipationWorkbook(
          await loadParticipationWorkbook(
            await serializeParticipationWorkbook(workbook),
          ),
        ),
      ),
      /Struktur workbook partisipasi tidak valid/,
    );
  });
});
