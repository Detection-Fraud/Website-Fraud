import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { PROGRAM_COLORS } from "@/lib/api/constants";
import { resolveScope } from "@/lib/api/unit-scope";
import {
  averageCompliancePercent,
  calculateProgramCompliancePercent,
  classifyCompliancePercent,
} from "@/lib/compliance-metrics";
import { prisma } from "@/lib/prisma";
import { programYearBounds } from "@/lib/program-period";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";
import { z } from "zod";

const complianceTwSchema = z.enum(["ALL", "1", "2", "3", "4"]);

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const user = session.user;

    const { searchParams } = new URL(req.url);
    const twResult = complianceTwSchema.safeParse(
      searchParams.get("tw") ?? "ALL",
    );
    if (!twResult.success) {
      return NextResponse.json(
        errorResponse("Parameter tw tidak valid", 400),
        { status: 400 },
      );
    }
    const twFilter =
      twResult.data === "ALL" ? undefined : Number(twResult.data);
    const programId = searchParams.get("programId") || "ALL";
    const kanwilId = searchParams.get("kanwilId") || "ALL";
    const kancabId = searchParams.get("kancabId") || "ALL";
    const divisiId = searchParams.get("divisiId") || "ALL";
    const unitTypeFilter = searchParams.get("unitType") || "NASIONAL";
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );

    // ── Ambil unit aktif via shared helper ──
    const { activeUnits, whereClause } = await resolveScope(user, {
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
          where: {
            startDate: programYearBounds(year),
            ...(twFilter !== undefined && { tw: twFilter }),
          },
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
            AND: [
              whereClause,
              {
                status: "APPROVED",
                unitId: { not: null },
                programId: { in: allProgramIds },
              },
            ],
          },
          _count: { id: true },
        })
      : [];

    const programInfoList = periodPrograms.map((cat, i) => ({
      id: cat.id,
      name: cat.name,
      programIds: cat.programs.map((p) => p.id),
      frequency: cat.programs.reduce((sum, program) => sum + program.frequency, 0),
      color: PROGRAM_COLORS[i % PROGRAM_COLORS.length],
    }));

    // O(1) Map lookup untuk performa tinggi (menghindari O(N*M) loop scan)
    const submissionMap = new Map(
      submissions.map((item) => [
        `${item.unitId}:${item.programId}`,
        item._count.id,
      ]),
    );

    if (periodPrograms.length === 0) {
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
      const allProgramPercentages: number[] = [];
      const programCompliance = periodPrograms.map((category) => {
        const categoryProgramPercentages = category.programs.map((program) => {
          const submitted =
            submissionMap.get(`${unit.id}:${program.id}`) ?? 0;
          const pct = calculateProgramCompliancePercent(
            submitted,
            program.frequency,
          );
          allProgramPercentages.push(pct);
          return { submitted, frequency: program.frequency, pct };
        });
        const submitted = categoryProgramPercentages.reduce(
          (sum, program) => sum + program.submitted,
          0,
        );
        const target = categoryProgramPercentages.reduce(
          (sum, program) => sum + program.frequency,
          0,
        );
        const rawPct = averageCompliancePercent(
          category.programs.map((program, index) => {
            if (program.frequency <= 0) return 0;
            return (
              (categoryProgramPercentages[index].submitted /
                program.frequency) *
              100
            );
          }),
        );

        return {
          programId: category.id,
          pct: averageCompliancePercent(
            categoryProgramPercentages.map((program) => program.pct),
          ),
          rawPct,
          submitted,
          target,
        };
      });

      const avg = averageCompliancePercent(allProgramPercentages);

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

    // 4. Hitung statistik keseluruhan
    const totalUnit = activeUnits.length;
    const avgCompliance = averageCompliancePercent(
      tableData.map((unit) => unit.avg),
    );

    const statuses = tableData.map((unit) =>
      classifyCompliancePercent(unit.avg),
    );
    const unitOnTrack = statuses.filter((status) => status === "ON_TRACK").length;
    const waspada = statuses.filter((status) => status === "WATCH").length;
    const perluPerhatian = statuses.filter(
      (status) => status === "AT_RISK",
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
