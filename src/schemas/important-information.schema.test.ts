import assert from "node:assert/strict";
import { test } from "node:test";
import {
  importantInformationAltTextSchema,
  importantInformationIdSchema,
  importantInformationReorderSchema,
  importantInformationStatusSchema,
  parseImportantInformationFormData,
} from "./important-information.schema";

test("importantInformationIdSchema accepts valid UUID and rejects invalid", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(importantInformationIdSchema.parse(validUuid), validUuid);

  assert.throws(() => importantInformationIdSchema.parse("invalid-uuid"));
  assert.throws(() => importantInformationIdSchema.parse(""));
});

test("importantInformationAltTextSchema trims and enforces 1-300 chars", () => {
  assert.equal(
    importantInformationAltTextSchema.parse("  Banner PIC  "),
    "Banner PIC",
  );
  assert.equal(
    importantInformationAltTextSchema.parse("A".repeat(300)),
    "A".repeat(300),
  );

  assert.throws(() => importantInformationAltTextSchema.parse("   "));
  assert.throws(() => importantInformationAltTextSchema.parse("A".repeat(301)));
});

test("importantInformationStatusSchema enforces boolean isActive", () => {
  assert.deepEqual(importantInformationStatusSchema.parse({ isActive: true }), {
    isActive: true,
  });
  assert.deepEqual(
    importantInformationStatusSchema.parse({ isActive: false }),
    {
      isActive: false,
    },
  );

  assert.throws(() =>
    importantInformationStatusSchema.parse({ isActive: "true" }),
  );
  assert.throws(() => importantInformationStatusSchema.parse({}));
});

test("importantInformationReorderSchema validates ids array, uniqueness, and non-negative int revision", () => {
  const validUuid1 = "123e4567-e89b-12d3-a456-426614174001";
  const validUuid2 = "123e4567-e89b-12d3-a456-426614174002";

  const validPayload = {
    ids: [validUuid1, validUuid2],
    revision: 0,
  };
  assert.deepEqual(
    importantInformationReorderSchema.parse(validPayload),
    validPayload,
  );

  // Rejects empty ids
  assert.throws(() =>
    importantInformationReorderSchema.parse({ ids: [], revision: 0 }),
  );

  // Rejects duplicate ids
  assert.throws(() =>
    importantInformationReorderSchema.parse({
      ids: [validUuid1, validUuid1],
      revision: 0,
    }),
  );

  // Rejects negative revision
  assert.throws(() =>
    importantInformationReorderSchema.parse({
      ids: [validUuid1],
      revision: -1,
    }),
  );

  // Rejects non-integer revision
  assert.throws(() =>
    importantInformationReorderSchema.parse({
      ids: [validUuid1],
      revision: 1.5,
    }),
  );

  // Rejects unknown fields (.strict)
  assert.throws(() =>
    importantInformationReorderSchema.parse({
      ids: [validUuid1],
      revision: 0,
      unknownField: true,
    }),
  );
});

test("parseImportantInformationFormData handles create and update", () => {
  const file = new File(["test image"], "banner.png", { type: "image/png" });

  // 1. Valid create: ada file & altText
  const formDataCreate = new FormData();
  formDataCreate.append("altText", "Banner Penting");
  formDataCreate.append("file", file);

  const createResult = parseImportantInformationFormData(formDataCreate, {
    requireFile: true,
  });
  assert.equal(createResult.altText, "Banner Penting");
  assert.ok(createResult.file instanceof File);

  // 2. Create tanpa file: harus throw error
  const formDataNoFile = new FormData();
  formDataNoFile.append("altText", "Banner Penting");
  assert.throws(
    () =>
      parseImportantInformationFormData(formDataNoFile, { requireFile: true }),
    /File gambar wajib diunggah/,
  );

  // 3. Update tanpa file: harus sukses (file bernilai undefined)
  const updateResult = parseImportantInformationFormData(formDataNoFile, {
    requireFile: false,
  });
  assert.equal(updateResult.altText, "Banner Penting");
  assert.equal(updateResult.file, undefined);

  // 4. Ada field multipart terlarang: harus throw error
  const formDataExtra = new FormData();
  formDataExtra.append("altText", "Banner");
  formDataExtra.append("unknownField", "hacked");
  assert.throws(
    () =>
      parseImportantInformationFormData(formDataExtra, { requireFile: false }),
    /Field multipart tidak diizinkan/,
  );
});
