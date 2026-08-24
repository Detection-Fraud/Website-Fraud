import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import { participationFilterSchema } from "@/schemas/participation.schema";
import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";

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

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Template Partisipasi");
    ws.addRow([
      `REKAP PARTISIPASI: ${category.name.toUpperCase()} - TW ${tw} ${year}`,
    ]);
    ws.getRow(1).font = { bold: true };
    ws.addRow([]);
    ws.addRow(["NO", "UNIT KERJA", "PERSENTASE (%)"]);
    ws.getRow(3).font = { bold: true };
    units.forEach((u, idx) => ws.addRow([idx + 1, u.name, ""]));

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 40;
    ws.getColumn(3).width = 18;

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Template_Partisipasi_${category.name.replace(/\s+/g, "_")}_TW${tw}_${year}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
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
