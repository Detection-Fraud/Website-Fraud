import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CategoryCapabilities } from "./program-capabilities";
import {
  canImportParticipation,
  getCapabilityError,
  requiresAiCheck,
  requiresEvidence,
  usesDirectAdminScore,
} from "./program-capabilities";

const targetUnits = ["KEGIATAN", "PARTISIPASI_PERSEN"] as const;
const evidenceModes = ["NONE", "PHOTO_WITH_AI", "PHOTO_WITHOUT_AI"] as const;
const scoreInputModes = ["NONE", "EXCEL_IMPORT", "DIRECT_ADMIN"] as const;

const validTuples = new Set([
  "KEGIATAN|PHOTO_WITH_AI|NONE",
  "PARTISIPASI_PERSEN|PHOTO_WITHOUT_AI|DIRECT_ADMIN",
  "PARTISIPASI_PERSEN|NONE|EXCEL_IMPORT",
]);

function key(input: CategoryCapabilities): string {
  return `${input.targetUnit}|${input.evidenceMode}|${input.scoreInputMode}`;
}

describe("program capabilities", () => {
  it("accepts exactly the three approved capability tuples", () => {
    for (const targetUnit of targetUnits) {
      for (const evidenceMode of evidenceModes) {
        for (const scoreInputMode of scoreInputModes) {
          const capability = { targetUnit, evidenceMode, scoreInputMode };
          const expectedValid = validTuples.has(key(capability));

          assert.equal(
            getCapabilityError(capability) === null,
            expectedValid,
            key(capability),
          );
        }
      }
    }
  });

  it("uses exact predicates for activity, direct assessment, and Excel import", () => {
    const activity: CategoryCapabilities = {
      targetUnit: "KEGIATAN",
      evidenceMode: "PHOTO_WITH_AI",
      scoreInputMode: "NONE",
    };
    const toga: CategoryCapabilities = {
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "PHOTO_WITHOUT_AI",
      scoreInputMode: "DIRECT_ADMIN",
    };
    const excel: CategoryCapabilities = {
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "NONE",
      scoreInputMode: "EXCEL_IMPORT",
    };

    assert.equal(requiresEvidence(activity), true);
    assert.equal(requiresAiCheck(activity), true);
    assert.equal(usesDirectAdminScore(activity), false);
    assert.equal(canImportParticipation(activity), false);

    assert.equal(requiresEvidence(toga), true);
    assert.equal(requiresAiCheck(toga), false);
    assert.equal(usesDirectAdminScore(toga), true);
    assert.equal(canImportParticipation(toga), false);

    assert.equal(requiresEvidence(excel), false);
    assert.equal(requiresAiCheck(excel), false);
    assert.equal(usesDirectAdminScore(excel), false);
    assert.equal(canImportParticipation(excel), true);
  });

  it("rejects near-miss direct and Excel tuples", () => {
    assert.equal(
      usesDirectAdminScore({
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "NONE",
        scoreInputMode: "DIRECT_ADMIN",
      }),
      false,
    );
    assert.equal(
      canImportParticipation({
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "PHOTO_WITHOUT_AI",
        scoreInputMode: "EXCEL_IMPORT",
      }),
      false,
    );
  });
});
