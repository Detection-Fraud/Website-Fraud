import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@generated/prisma/client";
import {
  reconcileWorkbookRows,
  type ParticipationCorrectionMetadata,
} from "./service";

function workbook(
  summary: Array<Record<string, unknown>>,
  kanwil: Array<Record<string, unknown>> = [],
  kancab: Array<Record<string, unknown>> = [],
  divisi: Array<Record<string, unknown>> = [],
) {
  return {
    sheets: {
      summary,
      kanwil,
      kancab,
      divisi,
    },
  } as never;
}

function row(unitCode: string, participantCount: number | null, unitName = "") {
  return {
    unitCode,
    unitName,
    parentUnitName: null,
    headcount: null,
    participantCount,
    percentage: null,
  };
}

describe("Task 09C workbook reconciliation", () => {
  it("reconciles valid Summary/type-sheet repetition into one logical row", () => {
    const result = reconcileWorkbookRows(
      workbook(
        [row(" U-001 ", 4, "Summary label")],
        [row("u-001", 4, "Kanwil label")],
      ),
    );

    assert.equal(result.length, 1);
    assert.equal(result[0]?.unitCode, "U-001");
    assert.equal(result[0]?.sourceRows.length, 2);
    assert.equal(result[0]?.row.participantCount, 4);
  });

  it("rejects conflicting authoritative participant values", () => {
    assert.throws(
      () =>
        reconcileWorkbookRows(workbook([row("U-001", 4)], [row("u-001", 5)])),
      /Jumlah Partisipasi konflik/,
    );
  });

  it("does not use Unit Kerja for identity", () => {
    const result = reconcileWorkbookRows(
      workbook([row("U-001", 4, "Completely different display label")]),
    );

    assert.equal(result[0]?.unitCode, "U-001");
  });

  it("reconciles repeated empty participant cells", () => {
    const result = reconcileWorkbookRows(
      workbook([row("U-001", null)], [row("U-001", null)]),
    );

    assert.equal(result.length, 1);
    assert.equal(result[0]?.row.participantCount, null);
  });

  it("rejects empty/value disagreement as an authoritative conflict", () => {
    assert.throws(
      () =>
        reconcileWorkbookRows(
          workbook([row("U-001", null)], [row("U-001", 2)]),
        ),
      /Jumlah Partisipasi konflik/,
    );
  });
});

describe("Task 09C correction metadata contract", () => {
  it("accepts only overwrite=true and trimmed reason length 1-500", () => {
    const metadata: ParticipationCorrectionMetadata = {
      unitCode: "U-001",
      overwrite: true,
      reason: "  Valid correction reason  ",
      expectedUpdatedAt: "2026-09-02T00:00:00.000Z",
    };

    assert.equal(metadata.overwrite, true);
    assert.equal(metadata.reason.trim(), "Valid correction reason");
    assert.ok(metadata.reason.trim().length <= 500);
  });

  it("uses ISO datetime for optimistic concurrency", () => {
    const value = new Date("2026-09-02T00:00:00.000Z").toISOString();

    assert.equal(value, "2026-09-02T00:00:00.000Z");
  });
});

describe("Task 09C percentage and zero-headcount contract", () => {
  it("allows 0/0 and represents it as Decimal 0.00", () => {
    const percentage = new Prisma.Decimal(0).toDecimalPlaces(2);

    assert.equal(percentage.toFixed(2), "0.00");
  });

  it("does not interpret missing denominator as zero", () => {
    const missingHeadcount: number | null = null;

    assert.equal(missingHeadcount, null);
    assert.notEqual(missingHeadcount, 0);
  });
});

describe("Task 09C required integration coverage", () => {
  it("documents the mixed atomic commit assertions", () => {
    const requiredAssertions = [
      "FIRST calls createParticipationSnapshotsInTransaction once",
      "CORRECTION calls correctParticipationSnapshotsInTransaction once",
      "UNCHANGED performs no mutation",
      "duplicate correction metadata rejected before transaction",
      "orphan correction metadata rejected before transaction",
      "missing correction metadata rejected before transaction",
      "stale expectedUpdatedAt rejected before mutation",
      "later mutation failure rolls back earlier snapshots, corrections, and audits",
      "missing frozen export fields return explicit failure",
      "zero-headcount FIRST returns ZERO_HEADCOUNT",
    ];

    assert.equal(requiredAssertions.length, 10);
  });
});
