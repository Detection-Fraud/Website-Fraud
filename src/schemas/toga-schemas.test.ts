import { getCapabilityError } from "@/lib/program-capabilities";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoryQuerySchema,
  participationReportQuerySchema,
  programPurposeSchema,
} from "./category-query.schema";
import { participationScoreSchema } from "./participation-score.schema";
import { participationFilterSchema } from "./participation.schema";
import { createCategorySchema, updateCategorySchema } from "./program.schema";
import { createReportSchema } from "./report.schema";

describe("TOGA schemas", () => {
  it("accepts only the three complete category capability tuples", () => {
    const validCategories = [
      {
        name: "Kegiatan",
        targetUnit: "KEGIATAN",
        evidenceMode: "PHOTO_WITH_AI",
        scoreInputMode: "NONE",
      },
      {
        name: "TOGA",
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "PHOTO_WITHOUT_AI",
        scoreInputMode: "DIRECT_ADMIN",
      },
      {
        name: "Import Persen",
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "NONE",
        scoreInputMode: "EXCEL_IMPORT",
      },
    ] as const;

    for (const category of validCategories) {
      assert.equal(createCategorySchema.safeParse(category).success, true);
    }

    assert.equal(
      createCategorySchema.safeParse({
        name: "Invalid Direct",
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "NONE",
        scoreInputMode: "DIRECT_ADMIN",
      }).success,
      false,
    );
    assert.equal(
      createCategorySchema.safeParse({
        name: "Invalid Excel",
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "PHOTO_WITHOUT_AI",
        scoreInputMode: "EXCEL_IMPORT",
      }).success,
      false,
    );
  });

  it("does not default omitted fields in partial category updates", () => {
    assert.equal(
      updateCategorySchema.safeParse({ scoreInputMode: "DIRECT_ADMIN" })
        .success,
      true,
    );
    assert.equal(
      updateCategorySchema.safeParse({
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "NONE",
        scoreInputMode: "DIRECT_ADMIN",
      }).success,
      false,
    );

    const storedActivity = {
      targetUnit: "KEGIATAN" as const,
      evidenceMode: "PHOTO_WITH_AI" as const,
      scoreInputMode: "NONE" as const,
    };
    const directPatch = { scoreInputMode: "DIRECT_ADMIN" as const };
    const merged = { ...storedActivity, ...directPatch };

    assert.notEqual(getCapabilityError(merged), null);
  });

  it("keeps ALL as a typed program purpose value", () => {
    assert.deepEqual(programPurposeSchema.parse("ALL"), "ALL");
    assert.equal(programPurposeSchema.safeParse("EVIDENCE").success, true);
  });

  it("preserves report photo validation", () => {
    const report = {
      activityName: "Kegiatan budaya karyawan",
      tanggalKegiatan: "2026-08-27",
      lokasi: "Kantor Pusat",
      description: "Kegiatan budaya dilakukan bersama seluruh karyawan.",
      programId: "00000000-0000-4000-8000-000000000001",
      uploadedPhotos: [{ originalName: "kegiatan.jpg", imageUrl: "https://example.com/kegiatan.jpg" }],
    };

    assert.equal(createReportSchema.safeParse(report).success, true);
    assert.equal(
      createReportSchema.safeParse({ ...report, uploadedPhotos: [] }).success,
      false,
    );
    assert.equal(
      createReportSchema.safeParse({
        ...report,
        uploadedPhotos: [
          { originalName: "one.jpg", imageUrl: "https://example.com/one.jpg" },
          { originalName: "two.jpg", imageUrl: "https://example.com/two.jpg" },
          { originalName: "three.jpg", imageUrl: "https://example.com/three.jpg" },
        ],
      }).success,
      false,
    );
  });

  it("preserves participation score boundaries", () => {
    assert.equal(participationScoreSchema.safeParse({ percentage: 0 }).success, true);
    assert.equal(participationScoreSchema.safeParse({ percentage: 100 }).success, true);
    assert.equal(participationScoreSchema.safeParse({ percentage: -1 }).success, false);
    assert.equal(participationScoreSchema.safeParse({ percentage: 101 }).success, false);
    assert.equal(participationScoreSchema.safeParse({ percentage: 50.5 }).success, false);
  });

  it("preserves typed category and Excel participation queries", () => {
    assert.equal(
      categoryQuerySchema.safeParse({
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "NONE",
        scoreInputMode: "EXCEL_IMPORT",
      }).success,
      true,
    );
    assert.equal(
      categoryQuerySchema.safeParse({ scoreInputMode: "INVALID" }).success,
      false,
    );

    const query = participationReportQuerySchema.parse({ year: 2026 });
    assert.equal(query.year, 2026);
    assert.equal(query.participationType, "ALL");
    assert.equal(query.page, 1);
    assert.equal(query.limit, 25);
    assert.equal(
      participationFilterSchema.safeParse({
        categoryId: "00000000-0000-4000-8000-000000000001",
        tw: 1,
        year: 2026,
      }).success,
      true,
    );
  });
});
