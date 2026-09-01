import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATEGORY_CAPABILITY_PRESETS,
  getCategoryCapabilityPreset,
  getCategoryCapabilityPresetForForm,
} from "./category-capability-presets";

describe("category-capability-presets", () => {
  it("exposes exactly three selectable presets", () => {
    assert.equal(CATEGORY_CAPABILITY_PRESETS.length, 3);
    assert.equal(
      CATEGORY_CAPABILITY_PRESETS.filter((preset) => preset.isSelectable)
        .length,
      3,
    );
  });

  it("maps all three valid capability tuples to their respective presets", () => {
    const kegiatan = getCategoryCapabilityPreset({
      targetUnit: "KEGIATAN",
      evidenceMode: "PHOTO_WITH_AI",
      scoreInputMode: "NONE",
    });
    assert.equal(kegiatan.id, "KEGIATAN_PHOTO_WITH_AI_NONE");
    assert.equal(kegiatan.isSelectable, true);
    assert.equal(kegiatan.showFrequency, true);

    const directAdmin = getCategoryCapabilityPreset({
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "PHOTO_WITHOUT_AI",
      scoreInputMode: "DIRECT_ADMIN",
    });
    assert.equal(directAdmin.id, "PARTISIPASI_PHOTO_WITHOUT_AI_DIRECT_ADMIN");
    assert.equal(directAdmin.isSelectable, true);
    assert.equal(directAdmin.showFrequency, true);

    const excel = getCategoryCapabilityPreset({
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "NONE",
      scoreInputMode: "EXCEL_IMPORT",
    });
    assert.equal(excel.id, "PARTISIPASI_NONE_EXCEL_IMPORT");
    assert.equal(excel.isSelectable, true);
    assert.equal(excel.showFrequency, false);
  });

  it("returns a neutral non-selectable presentation for unmatched tuples", () => {
    const unmatched = getCategoryCapabilityPreset({
      targetUnit: "KEGIATAN",
      evidenceMode: "NONE",
      scoreInputMode: "EXCEL_IMPORT",
    });

    assert.equal(unmatched.id, "UNMATCHED");
    assert.equal(unmatched.title, "Kapabilitas tidak dikenali");
    assert.equal(unmatched.evidenceLabel, "Tidak tersedia");
    assert.equal(unmatched.scoreLabel, "Tidak tersedia");
    assert.equal(unmatched.showFrequency, false);
    assert.equal(unmatched.isSelectable, false);
  });

  it("resolves form preset by ID with deterministic fallback to the first preset", () => {
    const found = getCategoryCapabilityPresetForForm(
      "PARTISIPASI_NONE_EXCEL_IMPORT",
    );
    assert.equal(found.id, "PARTISIPASI_NONE_EXCEL_IMPORT");

    const fallback = getCategoryCapabilityPresetForForm("UNKNOWN_ID");
    assert.equal(fallback.id, CATEGORY_CAPABILITY_PRESETS[0].id);
    assert.equal(fallback.isSelectable, true);
  });
});
