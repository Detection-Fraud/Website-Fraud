import { z } from "zod";

export const importantInformationIdSchema = z
  .string()
  .uuid("ID Informasi Penting tidak valid");

export const importantInformationAltTextSchema = z
  .string()
  .trim()
  .min(1, "Teks alternatif wajib diisi")
  .max(300, "Teks alternatif maksimal 300 karakter");

export const importantInformationStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const importantInformationReorderSchema = z
  .object({
    ids: z
      .array(importantInformationIdSchema)
      .min(1, "Daftar ID tidak boleh kosong"),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine(({ ids }, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["ids"],
        message: "Daftar ID tidak boleh mengandung duplikat",
      });
    }
  });

export type ImportantInformationFormData = {
  altText: string;
  file?: File;
};

export function parseImportantInformationFormData(
  formData: FormData,
  options: { requireFile: boolean },
): ImportantInformationFormData {
  const allowedFields = new Set(["altText", "file"]);
  for (const key of formData.keys()) {
    if (!allowedFields.has(key))
      throw new Error("Field multipart tidak diizinkan");
  }

  const altTextValue = formData.get("altText");
  if (typeof altTextValue !== "string")
    throw new Error("Teks alternatif wajib diisi");
  const altText = importantInformationAltTextSchema.parse(altTextValue);
  const fileValue = formData.get("file");

  if (
    fileValue === null ||
    (fileValue instanceof File && fileValue.size === 0)
  ) {
    if (options.requireFile) throw new Error("File gambar wajib diunggah");
    return { altText };
  }
  if (!(fileValue instanceof File)) throw new Error("File gambar tidak valid");

  return { altText, file: fileValue };
}
