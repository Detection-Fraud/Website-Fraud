import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  toLegacyParticipationPreview,
  toLegacyParticipationPreviewRow,
} from "./participation-adapter";

describe("participation adapter", () => {
  it("preserves Task 9 row metadata while projecting legacy status names", () => {
    const row = toLegacyParticipationPreviewRow({
      id: 4,
      sheetKey: "SUMMARY",
      rowNumber: 7,
      unitCode: "UNIT-A",
      unitId: "unit-a",
      unitName: "Unit A",
      participantCount: 81,
      headcount: 100,
      percentage: 81,
      existingParticipantCount: 80,
      existingPercentage: 80,
      expectedUpdatedAt: "2026-09-02T00:00:00.000Z",
      warning: null,
      status: "CORRECTION",
      errorMsg: undefined,
    });

    assert.equal(row.status, "conflict");
    assert.equal(row.sourceStatus, "CORRECTION");
    assert.equal(row.unitCode, "UNIT-A");
    assert.equal(row.participantCount, 81);
    assert.equal(row.headcount, 100);
    assert.equal(row.expectedUpdatedAt, "2026-09-02T00:00:00.000Z");
  });

  it("maps Task 9 stats to the legacy UI aliases", () => {
    const result = toLegacyParticipationPreview({
      stats: {
        total: 5,
        first: 2,
        unchanged: 1,
        correction: 1,
        empty: 1,
        error: 0,
      },
      rows: [],
    });

    assert.equal(result.stats.matched, 2);
    assert.equal(result.stats.conflict, 1);
    assert.equal(result.stats.first, 2);
    assert.equal(result.stats.correction, 1);
    assert.equal(result.stats.total, 5);
  });
});
