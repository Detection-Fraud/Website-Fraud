import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { PROGRAM_COLORS } from "@/lib/api/constants";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAuth();

    const currentYear = new Date().getFullYear();

    const [kanwilList, divisiList, categories, distinctDates] =
      await Promise.all([
        prisma.unit.findMany({
          where: { type: "KANTOR_WILAYAH" },
          select: { id: true, name: true, kodeDolog: true },
          orderBy: [{ kodeDolog: "asc" }, { name: "asc" }],
        }),
        prisma.unit.findMany({
          where: { type: "DIVISI" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.programCategory.findMany({
          where: { targetUnit: "KEGIATAN" },
          select: { id: true, name: true, color: true },
          orderBy: { name: "asc" },
        }),
        prisma.activityReport.findMany({
          select: { tanggalKegiatan: true },
          distinct: ["tanggalKegiatan"],
        }),
      ]);

    const yearSet = new Set<number>();
    yearSet.add(currentYear);
    yearSet.add(currentYear + 1);

    distinctDates.forEach((report) => {
      if (report.tanggalKegiatan) {
        yearSet.add(new Date(report.tanggalKegiatan).getFullYear());
      }
    });

    const yearList = Array.from(yearSet).sort((a, b) => b - a);

    const categoryList = categories.map((c, index) => ({
      id: c.id,
      name: c.name,
      color: c.color || PROGRAM_COLORS[index % PROGRAM_COLORS.length],
    }));

    const formattedKanwilList = kanwilList.map((k) => ({
      id: k.id,
      name:
        k.kodeDolog && k.kodeDolog !== "00"
          ? `${parseInt(k.kodeDolog, 10)}. ${k.name.replace("KANTOR WILAYAH ", "Kanwil ")}`
          : k.name,
    }));

    return NextResponse.json(
      successResponse(
        {
          kanwilList: formattedKanwilList,
          divisiList,
          programList: categoryList,
          yearList,
        },
        "Berhasil mengambil opsi filter",
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/filter-options");
  }
}
