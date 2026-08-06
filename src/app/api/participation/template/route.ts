import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import { participationFilterSchema } from "@/schemas/participation.schema";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const parsed = participationFilterSchema.safeParse({
      categoryId: searchParams.get("categoryId"),
      tw: searchParams.get("tw"),
      year: searchParams.get("year"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0].message, 400),
        { status: 400 },
      );
    }

    const { categoryId, tw, year } = parsed.data;

    const category = await prisma.programCategory.findUnique({
      where: { id: categoryId },
      select: { name: true, targetUnit: true },
    });

    if (!category || category.targetUnit !== "PARTISIPASI_PERSEN") {
      return NextResponse.json(
        errorResponse(
          "Kategori tidak ditemukan atau bukan jenis Partisipasi Persentase",
          400,
        ),
        { status: 400 },
      );
    }

    const units = await prisma.unit.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    });

    const wb = XLSX.utils.book_new();

    const titleRow = [
      `REKAP PARTISIPASI: ${category.name.toUpperCase()} - TW ${tw} ${year}`,
    ];
    const emptyRow: string[] = [];
    const headerRow = ["NO", "UNIT KERJA", "PERSENTASE (%)"];
    const dataRows = units.map((u, idx) => [idx + 1, u.name, ""]);

    const ws = XLSX.utils.aoa_to_sheet([
      titleRow,
      emptyRow,
      headerRow,
      ...dataRows,
    ]);
    ws["!cols"] = [{ wch: 6 }, { wch: 40 }, { wch: 18 }];

    XLSX.utils.book_append_sheet(wb, ws, "Template Partisipasi");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `Template_Partisipasi_${category.name.replace(/\s+/g, "_")}_TW${tw}_${year}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/participation/template");
  }
}
