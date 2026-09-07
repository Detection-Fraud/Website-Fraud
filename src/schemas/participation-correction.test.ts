import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { participationCorrectionSchema } from "./participation.schema";

const validBase = {
  categoryId: "22222222-2222-4222-8222-222222222222",
  tw: 1,
  year: 2026,
};

const validUnitId = "11111111-1111-4111-8111-111111111111";

describe("participationCorrectionSchema", () => {
  it("menolak payload legacy berbasis percentage", () => {
    const result = participationCorrectionSchema.safeParse({
      ...validBase,
      rows: [
        {
          unitId: validUnitId,
          percentage: 80,
          overwrite: true,
        },
      ],
    });

    assert.equal(result.success, false);
  });

  it("mewajibkan alasan saat overwrite=true", () => {
    const result = participationCorrectionSchema.safeParse({
      ...validBase,
      rows: [
        {
          unitId: validUnitId,
          participantCount: 80,
          overwrite: true,
          reason: "   ",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  it("menerima participantCount non-negatif dengan overwrite=false", () => {
    const result = participationCorrectionSchema.safeParse({
      ...validBase,
      rows: [
        {
          unitId: validUnitId,
          participantCount: 80,
          overwrite: false,
        },
      ],
    });

    assert.equal(result.success, true);
  });

  it("memangkas alasan sebelum diteruskan", () => {
    const result = participationCorrectionSchema.safeParse({
      ...validBase,
      rows: [
        {
          unitId: validUnitId,
          participantCount: 80,
          overwrite: true,
          reason: "  Alasan koreksi  ",
        },
      ],
    });

    assert.equal(result.success, true);

    if (result.success) {
      assert.equal(result.data.rows[0].reason, "Alasan koreksi");
    }
  });

  it("menolak participantCount negatif", () => {
    const result = participationCorrectionSchema.safeParse({
      ...validBase,
      rows: [
        {
          unitId: validUnitId,
          participantCount: -1,
          overwrite: true,
          reason: "Jumlah peserta tidak valid",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  it("menolak participantCount pecahan", () => {
    const result = participationCorrectionSchema.safeParse({
      ...validBase,
      rows: [
        {
          unitId: validUnitId,
          participantCount: 10.5,
          overwrite: true,
          reason: "Jumlah peserta tidak valid",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  it("menolak unit duplikat dalam satu koreksi", () => {
    const result = participationCorrectionSchema.safeParse({
      ...validBase,
      rows: [
        {
          unitId: validUnitId,
          participantCount: 80,
          overwrite: false,
        },
        {
          unitId: validUnitId,
          participantCount: 81,
          overwrite: true,
          reason: "Koreksi duplikat",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  it("menolak field yang tidak dikenal", () => {
    const result = participationCorrectionSchema.safeParse({
      ...validBase,
      rows: [
        {
          unitId: validUnitId,
          participantCount: 80,
          overwrite: false,
          percentage: 80,
        },
      ],
    });

    assert.equal(result.success, false);
  });
});
