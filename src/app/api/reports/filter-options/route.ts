import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { PROGRAM_COLORS } from "@/lib/api/constants";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAuth();

    const [kanwilList, divisiList, categories] = await Promise.all([
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
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      }),
    ]);

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
        },
        "Berhasil mengambil opsi filter",
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/filter-options");
  }
}
