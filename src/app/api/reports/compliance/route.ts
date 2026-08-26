import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { PROGRAM_COLORS } from "@/lib/api/constants";
import { resolveScope } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import { programYearBounds } from "@/lib/program-period";
import { successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const user = session.user;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId") || "ALL";
    const kanwilId = searchParams.get("kanwilId") || "ALL";
    const kancabId = searchParams.get("kancabId") || "ALL";
    const divisiId = searchParams.get("divisiId") || "ALL";
    const unitTypeFilter = searchParams.get("unitType") || "NASIONAL";
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );

    // ── Ambil unit aktif via shared helper ──
    const { activeUnits } = await resolveScope(user, {
      kanwilId,
      kancabId,
      divisiId,
      unitTypeFilter,
    });

    // 1. Ambil kategori dan program tahun terpilih (termasuk yang nonaktif untuk historis)
    const programs = await prisma.programCategory.findMany({
      where: {
        targetUnit: "KEGIATAN",
        ...(programId !== "ALL" && { id: programId }),
      },
      include: {
        programs: {
          where: { startDate: programYearBounds(year) },
          select: { id: true, frequency: true, tw: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Filter kategori yang memiliki program di tahun ini agar target tidak 1 semu
    const periodPrograms = programs.filter(
      (category) => category.programs.length > 0,
    );

    const allProgramIds = periodPrograms.flatMap((category) =>
      category.programs.map((program) => program.id),
    );

    // 2. Query aggregasi approved reports dalam scope program tahun ini
    const submissions = allProgramIds.length > 0
      ? await prisma.activityReport.groupBy({
          by: ["unitId", "programId"],
          where: {
            status: "APPROVED",
            unitId: { not: null },
            programId: { in: allProgramIds },
          },
          _count: { id: true },
        })
      : [];

    const programInfoList = periodPrograms.map((cat, i) => ({
      id: cat.id,
      name: cat.name,
      programIds: cat.programs.map((p) => p.id),
      frequency: cat.programs.reduce((s, p) => s + p.frequency, 0) || 1,
      color: PROGRAM_COLORS[i % PROGRAM_COLORS.length],
    }));

    // O(1) Map lookup untuk performa tinggi (menghindari O(N*M) loop scan)
    const submissionMap = new Map(
      submissions.map((item) => [
        `${item.unitId}:${item.programId}`,
        item._count.id,
      ]),
    );

    const getUnitSubmissions = (unitId: string, progIds: string[]) =>
      progIds.reduce(
        (sum, id) => sum + (submissionMap.get(`${unitId}:${id}`) ?? 0),
        0,
      );

    if (submissions.length === 0) {
      return NextResponse.json(
        successResponse(
          {
            cards: {
              totalUnit: 0,
              avgCompliance: 0,
              unitOnTrack: 0,
              waspada: 0,
              perluPerhatian: 0,
            },
            programs: programInfoList,
            tableData: [],
          },
          "Berhasil memuat data compliance (tidak ada laporan)",
        ),
        { status: 200 },
      );
    }

    // 3. Kalkulasi compliance per unit
    const tableData = activeUnits.map((unit) => {
      const programCompliance = programInfoList.map((prog) => {
        const submitted = getUnitSubmissions(unit.id, prog.programIds);
        const target = prog.frequency || 1;
        const rawPct = Math.round((submitted / target) * 100);
        const pct = Math.min(rawPct, 120);
        return {
          programId: prog.id,
          pct,
          rawPct,
          submitted,
          target,
        };
      });

      const relevantPct =
        programId === "ALL"
          ? programCompliance.map((p) => p.pct)
          : programCompliance
              .filter((p) => p.programId === programId)
              .map((p) => p.pct);

      const avg =
        relevantPct.length > 0
          ? Number(
              (
                relevantPct.reduce((a, b) => a + b, 0) / relevantPct.length
              ).toFixed(1),
            )
          : 0;

      return {
        rank: 0,
        unit,
        programCompliance,
        avg,
      };
    });

    const filteredTableData = tableData.filter((u) =>
      u.programCompliance.some((p) => p.submitted > 0),
    );

    filteredTableData.sort((a, b) => b.avg - a.avg);
    filteredTableData.forEach((row, index) => {
      row.rank = index + 1;
    });

    // 4. Hitung statistik keseluruhan
    const reportedUnitsCount = filteredTableData.filter((u) =>
      u.programCompliance.some((p) => p.submitted > 0),
    ).length;
    const totalUnit = reportedUnitsCount;
    const avgCompliance =
      totalUnit > 0
        ? Math.round(
            filteredTableData.reduce((sum, u) => sum + u.avg, 0) / totalUnit,
          )
        : 0;

    const unitOnTrack = filteredTableData.filter((u) => u.avg >= 50).length;
    const waspada = filteredTableData.filter(
      (u) => u.avg >= 25 && u.avg < 50,
    ).length;
    const perluPerhatian = filteredTableData.filter(
      (u) => u.avg < 25 && u.programCompliance.some((p) => p.submitted > 0),
    ).length;

    return NextResponse.json(
      successResponse(
        {
          cards: {
            totalUnit,
            avgCompliance,
            unitOnTrack,
            waspada,
            perluPerhatian,
          },
          programs: programInfoList,
          tableData: filteredTableData,
        },
        "Berhasil memuat data compliance",
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/compliance");
  }
}
