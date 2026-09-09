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

let buildParticipationExport: typeof import("./service")["buildParticipationExport"];
let commitParticipationWorkbook: typeof import("./service")["commitParticipationWorkbook"];
let previewParticipationWorkbook: typeof import("./service")["previewParticipationWorkbook"];

before(async () => {
  ({ buildParticipationExport, commitParticipationWorkbook, previewParticipationWorkbook } = await import("./service"));
});

const categoryId = "22222222-2222-4222-8222-222222222222";
const firstUnitId = "11111111-1111-4111-8111-111111111111";
const correctionUnitId = "33333333-3333-4333-8333-333333333333";
const unchangedUnitId = "44444444-4444-4444-8444-444444444444";
const zeroUnitId = "55555555-5555-4555-8555-555555555555";
const updatedAt = new Date("2026-09-02T00:00:00.000Z");

function units() { return [
  { id: firstUnitId, kodeOrg: "U-FIRST", name: "Unit First", type: "DIVISI" as const, parent: { name: "Parent First" } },
  { id: correctionUnitId, kodeOrg: "U-CORRECTION", name: "Unit Correction", type: "KANTOR_CABANG" as const, parent: { name: "Parent Correction" } },
  { id: unchangedUnitId, kodeOrg: "U-UNCHANGED", name: "Unit Unchanged", type: "KANTOR_WILAYAH" as const, parent: { name: "Parent Unchanged" } },
  { id: zeroUnitId, kodeOrg: "U-ZERO", name: "Unit Zero", type: "DIVISI" as const, parent: null },
]; }

function row(unitCode: string, participantCount: number | null, overrides: Record<string, unknown> = {}) {
  return { unitCode, unitName: "Workbook label", parentUnitName: "Workbook parent", headcount: 9999, participantCount, percentage: 99.99, ...overrides };
}

async function workbookBuffer(rows: ReturnType<typeof row>[]) {
  const workbook = generateParticipationWorkbook({ summary: rows, kanwil: [], kancab: [], divisi: [] });
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
    assert.deepEqual(result.rows.map((item) => [item.unitCode, item.status]), [["U-CORRECTION", "CORRECTION"], ["U-FIRST", "FIRST"], ["U-UNCHANGED", "UNCHANGED"], ["U-ZERO", "UNCHANGED"]]);
    assert.equal(result.rows.find((item) => item.unitCode === "U-CORRECTION")?.expectedUpdatedAt, updatedAt.toISOString());
    assert.equal(result.rows.find((item) => item.unitCode === "U-ZERO")?.warning, "ZERO_HEADCOUNT");
    assert.equal(transactionMock.mock.callCount(), 0);
  });

  it("uses only Kode Unit and Jumlah Partisipasi as import authority", async () => {
    const result = await previewParticipationWorkbook({ buffer: await workbookBuffer([row("U-FIRST", 2, { unitName: "Forged", parentUnitName: "Forged Parent", headcount: 9999, percentage: 0.01 })]), categoryId, tw: 1, year: 2026 });
    const preview = result.rows[0];
    assert.equal(preview?.unitCode, "U-FIRST"); assert.equal(preview?.participantCount, 2); assert.equal(preview?.headcount, 4); assert.equal(preview?.percentage, 50); assert.equal(preview?.unitName, "Unit First");
  });

  it("counts unknown and invalid rows as ERROR", async () => {
    const result = await previewParticipationWorkbook({ buffer: await workbookBuffer([row("U-UNKNOWN", 2), row("U-FIRST", 5)]), categoryId, tw: 1, year: 2026 });
    assert.equal(result.stats.error, 2); assert.equal(result.rows.every((item) => item.status === "ERROR"), true); assert.ok(result.rows.some((item) => item.errorMsg?.includes("Kode Unit tidak ditemukan"))); assert.ok(result.rows.some((item) => item.errorMsg?.includes("Jumlah Partisipasi")));
  });

  it("requires matching expectedUpdatedAt and rejects stale corrections before mutation", async () => {
    participationFindManyMock.mock.mockImplementation(async () => existingRows());
    const input = { buffer: await workbookBuffer([row("U-CORRECTION", 4)]), categoryId, tw: 1, year: 2026, actorId: "admin-1", actorName: "Admin Test" };
    await assert.rejects(commitParticipationWorkbook({ ...input, corrections: [] }), (error: { status?: number }) => error.status === 400);
    await assert.rejects(commitParticipationWorkbook({ ...input, corrections: [{ unitCode: "U-CORRECTION", overwrite: true, reason: "Verified", expectedUpdatedAt: "2026-09-01T00:00:00.000Z" }] }), (error: { status?: number }) => error.status === 409);
    assert.equal(transactionMock.mock.callCount(), 0); assert.equal(createSnapshotsMock.mock.callCount(), 0); assert.equal(correctSnapshotsMock.mock.callCount(), 0);
  });

  it("uses one Serializable transaction for mixed FIRST/CORRECTION/UNCHANGED commit", async () => {
    participationFindManyMock.mock.mockImplementation(async () => existingRows());
    const result = await commitParticipationWorkbook({ buffer: await workbookBuffer([row("U-CORRECTION", 4), row("U-FIRST", 2), row("U-UNCHANGED", 5), row("U-ZERO", 0)]), categoryId, tw: 1, year: 2026, actorId: "admin-1", actorName: "Admin Test", corrections: [{ unitCode: "U-CORRECTION", overwrite: true, reason: "Verified", expectedUpdatedAt: updatedAt.toISOString() }] });
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
        corrections: [{ unitCode: "U-CORRECTION", overwrite: true, reason: "Verified", expectedUpdatedAt: updatedAt.toISOString() }],
      }),
      /correction failure/,
    );

    assert.deepEqual(committedState, []);
  });

  it("exports frozen fields and rejects incomplete frozen provenance", async () => {
    participationFindManyMock.mock.mockImplementationOnce(async () => [{ unitId: correctionUnitId, headcount: 10, participantCount: 4, percentage: new Prisma.Decimal("40.00"), provenance: "EMPLOYEE_SNAPSHOT", employeeSyncRunId: "sync-correction", headcountCapturedAt: new Date("2026-09-01T00:00:00.000Z"), unitNameSnapshot: "Historical Name", parentUnitNameSnapshot: "Historical Parent", categoryNameSnapshot: "Historical Category", unit: { kodeOrg: "U-CORRECTION", type: "KANTOR_CABANG" } }]);
    const parsed = parseParticipationWorkbook(await loadParticipationWorkbook(await buildParticipationExport({ categoryId, tw: 1, year: 2026 })));
    assert.equal(parsed.sheets.summary[0]?.unitName, "Historical Name"); assert.equal(parsed.sheets.summary[0]?.headcount, 10); assert.equal(parsed.sheets.summary[0]?.participantCount, 4); assert.equal(parsed.sheets.summary[0]?.percentage, 40);
    participationFindManyMock.mock.mockImplementationOnce(async () => [{ unitId: correctionUnitId, headcount: 10, participantCount: 4, percentage: new Prisma.Decimal("40.00"), provenance: "EMPLOYEE_SNAPSHOT", employeeSyncRunId: null, headcountCapturedAt: new Date("2026-09-01T00:00:00.000Z"), unitNameSnapshot: "Historical Name", parentUnitNameSnapshot: null, categoryNameSnapshot: "Historical Category", unit: { kodeOrg: "U-CORRECTION", type: "KANTOR_CABANG" } }]);
    await assert.rejects(buildParticipationExport({ categoryId, tw: 1, year: 2026 }), (error: { status?: number }) => error.status === 409);
  });

  it("fails closed on duplicate canonical codes through preview", async () => {
    unitFindManyMock.mock.mockImplementationOnce(async () => [{ ...units()[0], id: "duplicate-1", kodeOrg: "U-DUP" }, { ...units()[1], id: "duplicate-2", kodeOrg: " U-DUP " }]);
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
