import { resolveScope } from "@/lib/api/unit-scope";
import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { PROGRAM_COLORS } from "@/lib/api/constants";
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
      prisma.programBudaya.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.activityReport.groupBy({
        by: ["unitId", "programId"],
        where: {
          status: "APPROVED",
          ...(programId !== "ALL" && { programId }),
          unitId: { not: null },
          tanggalKegiatan: {
            gte: yearStart,
            lte: yearEnd,
          },
        },
        _count: { id: true },
      }),
    ]);

    const programInfoList = programs.map((p, i) => ({
      id: p.id,
      name: p.name,
      frequency: p.frequency,
      color: PROGRAM_COLORS[i % PROGRAM_COLORS.length],
    }));

    const getUnitSubmissions = (unitId: string, progId: string) => {
      let sum = 0;
      for (const sub of submissions) {
        if (sub.programId === progId && sub.unitId === unitId) {
          sum += sub._count.id;
        }
      }
      return sum;
    };

    // 5. Kalkulasi compliance per unit
    const tableData = activeUnits.map((unit) => {
      const programCompliance = programInfoList.map((prog) => {
        const submitted = getUnitSubmissions(unit.id, prog.id);
        const target = prog.frequency;
        const pct = Math.round((submitted / target) * 100);
        return {
          programId: prog.id,
          pct,
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
          ? Math.round(
              relevantPct.reduce((a, b) => a + b, 0) / relevantPct.length,
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
    const totalUnit = tableData.length;
    const avgCompliance =
      totalUnit > 0
        ? Math.round(tableData.reduce((sum, u) => sum + u.avg, 0) / totalUnit)
        : 0;

    const unitOnTrack = tableData.filter((u) => u.avg >= 50).length;
    const waspada = tableData.filter((u) => u.avg >= 25 && u.avg < 50).length;
    const perluPerhatian = tableData.filter((u) => u.avg < 25).length;

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
