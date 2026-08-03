import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { PROGRAM_COLORS } from "@/lib/api/constants";
import { resolveScope } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
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

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    // 4. Ambil program dan aggregasi laporan
    const [programs, submissions] = await Promise.all([
      prisma.programCategory.findMany({
        include: {
          programs: {
            where: { isActive: true },
            select: { id: true, frequency: true, tw: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.activityReport.groupBy({
        by: ["unitId", "programId"],
        where: {
          status: "APPROVED",
          ...(programId !== "ALL" && { program: { categoryId: programId } }),
          unitId: { not: null },
          tanggalKegiatan: {
            gte: yearStart,
            lte: yearEnd,
          },
        },
        _count: { id: true },
      }),
    ]);

    const programInfoList = programs.map((cat, i) => ({
      id: cat.id,
      name: cat.name,
      programIds: cat.programs.map((p) => p.id),
      frequency: cat.programs.reduce((s, p) => s + p.frequency, 0) || 1,
      color: PROGRAM_COLORS[i % PROGRAM_COLORS.length],
    }));

    const getUnitSubmissions = (unitId: string, progIds: string[]) => {
      let sum = 0;
      for (const sub of submissions) {
        if (progIds.includes(sub.programId!) && sub.unitId === unitId) {
          sum += sub._count.id;
        }
      }
      return sum;
    };

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

    // 5. Kalkulasi compliance per unit
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

    tableData.sort((a, b) => b.avg - a.avg);
    tableData.forEach((row, index) => {
      row.rank = index + 1;
    });

    // 6. Hitung statistik keseluruhan
    const reportedUnitsCount = tableData.filter((u) =>
      u.programCompliance.some((p) => p.submitted > 0),
    ).length;
    const totalUnit = reportedUnitsCount;
    const avgCompliance =
      totalUnit > 0
        ? Math.round(tableData.reduce((sum, u) => sum + u.avg, 0) / totalUnit)
        : 0;

    const unitOnTrack = tableData.filter((u) => u.avg >= 50).length;
    const waspada = tableData.filter((u) => u.avg >= 25 && u.avg < 50).length;
    const perluPerhatian = tableData.filter(
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
          tableData,
        },
        "Berhasil memuat data compliance",
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/compliance");
  }
}
