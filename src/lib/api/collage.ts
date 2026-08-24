import { z } from "zod";
import { ApiError } from "./auth-guard";
import { Prisma } from "@generated/prisma";
import { getChildUnitIds } from "./unit-scope";

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const collageGalleryQuerySchema = z
  .object({
    programId: z.string().uuid("Program tidak valid"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(12).default(12),
  })
  .strict();

export const picCollageExportQuerySchema = z
  .object({
    programId: z.string().uuid("Program tidak valid"),
  })
  .strict();

export const adminCollageExportQuerySchema = z
  .object({
    programId: z.string().optional(),
    categoryId: z.string().optional(),
    scope: z.enum(["KANWIL_ONLY", "KANWIL_AND_KANCAB", "KANCAB", "DIVISI"]),
    kanwilId: z.string().optional(),
    kancabId: z.string().optional(),
    divisiId: z.string().optional(),
    startDate: dateParam.optional(),
    endDate: dateParam.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasProgram = data.programId && data.programId !== "ALL";
    const hasCategory = data.categoryId && data.categoryId !== "ALL";

    if (!hasProgram && !hasCategory) {
      ctx.addIssue({
        code: "custom",
        path: ["programId"],
        message: "Pilih minimal salah satu Program atau Kategori",
      });
    }

    if (
      (data.startDate && !data.endDate) ||
      (!data.startDate && data.endDate)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Tanggal mulai dan selesai harus diisi bersamaan",
      });
    }

    if (
      ["KANWIL_ONLY", "KANWIL_AND_KANCAB"].includes(data.scope) &&
      (!data.kanwilId || data.kanwilId === "ALL")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["kanwilId"],
        message: "Kanwil wajib dipilih",
      });
    }

    if (
      data.scope === "KANCAB" &&
      (!data.kancabId || data.kancabId === "ALL")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["kancabId"],
        message: "Kancab wajib dipilih",
      });
    }

    if (
      data.scope === "DIVISI" &&
      (!data.divisiId || data.divisiId === "ALL")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["divisiId"],
        message: "Divisi wajib dipilih",
      });
    }
  });

export function getExactPicUnitId(user: {
  role: string;
  unitId: string | null;
}) {
  if (user.role !== "PIC")
    throw new ApiError("Hanya PIC yang dapat mengakses", 403);
  if (!user.unitId) throw new ApiError("Unit kerja PIC tidak ditemukan", 403);
  return user.unitId;
}

export function buildPicCollagePhotoWhere(
  unitId: string,
  programId: string,
): Prisma.ActivityPhotoWhereInput {
  return {
    report: {
      is: { unitId, programId, status: "APPROVED" },
    },
  };
}

export async function buildAdminCollagePhotoWhere(
  input: z.infer<typeof adminCollageExportQuerySchema>,
) {
  const report: Prisma.ActivityReportWhereInput = { status: "APPROVED" };

  if (input.programId && input.programId !== "ALL") {
    report.programId = input.programId;
  } else if (input.categoryId && input.categoryId !== "ALL") {
    report.program = { categoryId: input.categoryId };
  }

  if (input.startDate && input.endDate) {
    const start = new Date(`${input.startDate}T00:00:00.000`);
    const end = new Date(`${input.endDate}T23:59:59.999`);
    report.tanggalKegiatan = { gte: start, lte: end };
  }

  let labelUnitId: string;
  if (input.scope === "KANWIL_AND_KANCAB") {
    const childIds = await getChildUnitIds(input.kanwilId!);
    report.unitId = { in: [input.kanwilId!, ...childIds] };
    labelUnitId = input.kanwilId!;
  } else if (input.scope === "KANWIL_ONLY") {
    report.unitId = input.kanwilId;
    labelUnitId = input.kanwilId!;
  } else if (input.scope === "KANCAB") {
    report.unitId = input.kancabId;
    labelUnitId = input.kancabId!;
  } else {
    report.unitId = input.divisiId;
    labelUnitId = input.divisiId!;
  }

  return {
    where: { report: { is: report } } satisfies Prisma.ActivityPhotoWhereInput,
    labelUnitId,
  };
}
