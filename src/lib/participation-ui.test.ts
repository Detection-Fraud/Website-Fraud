import assert from "node:assert/strict";
import test from "node:test";
import {
  buildParticipationCommitPlan,
  getParticipationErrorMessage,
  getParticipationStatusLabel,
} from "@/lib/participation-ui";
import type { ParticipationPreviewRow } from "@/types/participation.types";

const row = (
  overrides: Partial<ParticipationPreviewRow> = {},
): ParticipationPreviewRow => ({
  id: 1,
  sheetKey: "UNIT-A",
  rowNumber: 2,
  unitCode: "UNIT-A",
  unitId: "unit-a",
  unitName: "Unit A",
  participantCount: 10,
  headcount: 20,
  percentage: 50,
  existingParticipantCount: null,
  existingPercentage: null,
  expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
  warning: null,
  status: "matched",
  sourceStatus: "FIRST",
  ...overrides,
});

test("builds a FIRST commit plan without correction reason", () => {
  const plan = buildParticipationCommitPlan([row()], false, {});

  assert.equal(plan.error, null);
  assert.equal(plan.actionableCount, 1);
  assert.deepEqual(plan.corrections, []);
});

test("requires confirmation for every CORRECTION row", () => {
  const plan = buildParticipationCommitPlan(
    [
      row({ id: 1, sourceStatus: "CORRECTION", status: "conflict" }),
      row({ id: 2, unitCode: "UNIT-B" }),
    ],
    false,
    {},
  );

  assert.match(plan.error ?? "", /Konfirmasi seluruh koreksi/);
  assert.equal(plan.actionableCount, 0);
  assert.deepEqual(plan.corrections, []);
});

test("requires a trimmed reason and sends canonical correction metadata", () => {
  const correction = row({
    sourceStatus: "CORRECTION",
    status: "conflict",
  });

  const missing = buildParticipationCommitPlan([correction], true, {});
  assert.match(missing.error ?? "", /Alasan koreksi wajib diisi/);

  const plan = buildParticipationCommitPlan(
    [correction],
    true,
    { 1: "  data diperbaiki  " },
  );

  assert.equal(plan.error, null);
  assert.deepEqual(plan.corrections, [
    {
      unitCode: "UNIT-A",
      overwrite: true,
      reason: "data diperbaiki",
      expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
});

test("does not allow a partially described correction commit", () => {
  const plan = buildParticipationCommitPlan(
    [
      row({ id: 1, sourceStatus: "CORRECTION", status: "conflict" }),
      row({
        id: 2,
        unitCode: "UNIT-B",
        sourceStatus: "CORRECTION",
        status: "conflict",
      }),
    ],
    true,
    { 1: "Alasan unit A" },
  );

  assert.match(
    plan.error ?? "",
    /Alasan koreksi wajib diisi untuk unit UNIT-B/,
  );
  assert.equal(plan.actionableCount, 0);
  assert.deepEqual(plan.corrections, []);
});

test("blocks EMPTY and ERROR previews", () => {
  for (const status of ["EMPTY", "ERROR"] as const) {
    const plan = buildParticipationCommitPlan(
      [
        row({
          sourceStatus: status,
          status: status === "EMPTY" ? "empty" : "error",
        }),
      ],
      false,
      {},
    );

    assert.notEqual(plan.error, null);
    assert.equal(plan.actionableCount, 0);
  }
});

test("uses canonical status labels and safe error fallback", () => {
  assert.deepEqual(
    (["FIRST", "UNCHANGED", "CORRECTION", "EMPTY", "ERROR"] as const).map(
      getParticipationStatusLabel,
    ),
    [
      "Data baru",
      "Sama (dilewati)",
      "Koreksi",
      "Kosong (wajib dilengkapi)",
      "Tidak valid",
    ],
  );

  assert.equal(
    getParticipationErrorMessage({
      response: { data: { message: "Ditolak" } },
    }),
    "Ditolak",
  );

  assert.equal(
    getParticipationErrorMessage({}),
    "Gagal memproses file Excel",
  );
});
