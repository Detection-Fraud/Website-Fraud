import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { resolveScope } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import { programYearBounds } from "@/lib/program-period";
import { errorResponse, successResponse } from "@/lib/response";
import { participationReportQuerySchema } from "@/schemas/participation-report.schema";
import type { ParticipationReportRow } from "@/types/participation-report.types";
import { NextResponse } from "next/server";
import { z } from "zod";

const DIRECT_EVIDENCE = {
  targetUnit: "PARTISIPASI_PERSEN" as const,
  evidenceMode: "PHOTO_WITHOUT_AI" as const,
  scoreInputMode: "DIRECT_ADMIN" as const,
};

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();
    const parsed = participationReportQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(
          "Filter laporan partisipasi tidak valid",
          400,
          z.treeifyError(parsed.error),
        ),
        { status: 400 },
      );
    }

    const filter = parsed.data;
    const { activeUnits } = await resolveScope(session.user, {
      kanwilId: filter.kanwilId,
      kancabId: filter.kancabId,
      divisiId: filter.divisiId,
      unitTypeFilter: filter.unitType,
    });
    const orderedUnits = [...activeUnits].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    if (filter.participationType === "VALUE_ONLY") {
      const unitIds = orderedUnits.map((unit) => unit.id);
      const categories = await prisma.programCategory.findMany({
        where: {
          targetUnit: "PARTISIPASI_PERSEN",
          ...(filter.categoryId ? { id: filter.categoryId } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const values =
        unitIds.length === 0 || categories.length === 0
          ? []
          : await prisma.participationData.findMany({
              where: {
                unitId: { in: unitIds },
                categoryId: { in: categories.map((category) => category.id) },
                year: filter.year,
                ...(filter.tw ? { tw: filter.tw } : {}),
              },
              select: {
                id: true,
                unitId: true,
                categoryId: true,
                tw: true,
                year: true,
                percentage: true,
                category: { select: { id: true, name: true } },
              },
            });
      const unitMap = new Map(orderedUnits.map((unit) => [unit.id, unit]));
      const categoryMap = new Map(
        categories.map((category) => [category.id, category]),
      );
      const rows: ParticipationReportRow[] = values
        .filter(
          (value) =>
            value.percentage !== null &&
            unitMap.has(value.unitId) &&
            categoryMap.has(value.categoryId),
        )
        .map((value) => ({
          key: `${value.unitId}:${value.categoryId}:${value.tw}:${value.year}`,
          unit: {
            ...unitMap.get(value.unitId)!,
            parentId: unitMap.get(value.unitId)!.parentId ?? null,
          },
          category: categoryMap.get(value.categoryId)!,
          program: { id: "VALUE_ONLY", tw: value.tw, year: value.year },
          participationType: "VALUE_ONLY",
          status: "SELESAI",
          reportId: null,
          reportNotes: null,
          score: null,
        }));
      const start = (filter.page - 1) * filter.limit;
      const total = rows.length;
      return NextResponse.json(
        successResponse(
          {
            data: rows.slice(start, start + filter.limit),
            pagination: {
              page: filter.page,
              limit: filter.limit,
              total,
              totalPages: Math.ceil(total / filter.limit),
            },
          },
          "Berhasil mengambil laporan partisipasi",
        ),
      );
    }

    const categories = await prisma.programCategory.findMany({
      where: {
        ...DIRECT_EVIDENCE,
        ...(filter.categoryId ? { id: filter.categoryId } : {}),
      },
      select: {
        id: true,
        name: true,
        programs: {
          where: {
            startDate: programYearBounds(filter.year),
            ...(filter.tw ? { tw: filter.tw } : {}),
          },
          select: { id: true, tw: true, startDate: true },
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
    const periods = categories.flatMap((category) =>
      category.programs
        .filter((program) => program.tw !== null)
        .map((program) => ({
          category: { id: category.id, name: category.name },
          program: {
            id: program.id,
            tw: program.tw!,
            year: new Date(program.startDate).getUTCFullYear(),
          },
        })),
    );
    const unitIds = orderedUnits.map((unit) => unit.id);
    const programIds = periods.map((period) => period.program.id);
    const start = (filter.page - 1) * filter.limit;
    const pageUnits =
      unitIds.length === 0
        ? []
        : await prisma.unit.findMany({
            where: { id: { in: unitIds } },
            select: { id: true, name: true, type: true, parentId: true },
            orderBy: { name: "asc" },
            skip: start,
            take: filter.limit,
          });
    const reportWhere = {
      unitId: { in: unitIds },
      programId: { in: programIds },
    };
    const reports =
      pageUnits.length === 0 || programIds.length === 0
        ? []
        : await prisma.activityReport.findMany({
            where: { ...reportWhere, unitId: { in: pageUnits.map((unit) => unit.id) } },
            select: {
              id: true,
              unitId: true,
              programId: true,
              status: true,
              notes: true,
              participationAssessment: {
                select: {
                  percentage: true,
                  assessedAt: true,
                  updatedAt: true,
                  assessedBy: { select: { id: true, name: true } },
                },
              },
            },
          });
    const reportMap = new Map(
      reports.map((report) => [
        `${report.unitId}:${report.programId}`,
        report,
      ]),
    );
    const rows: ParticipationReportRow[] = [];
    for (const unit of pageUnits) {
      for (const period of periods) {
        const report = reportMap.get(`${unit.id}:${period.program.id}`);
        const status: ParticipationReportRow["status"] = !report
          ? "BELUM_UPLOAD"
          : report.status === "PENDING"
            ? "PENDING"
            : report.status === "REJECTED"
              ? "REJECTED"
              : report.participationAssessment?.percentage === null ||
                  !report.participationAssessment
                ? "APPROVED_BELUM_DINILAI"
                : "SELESAI";
        const assessment = report?.participationAssessment;
        const score =
          assessment && assessment.percentage !== null
            ? {
                percentage: assessment.percentage,
                assessedBy: assessment.assessedBy,
                assessedAt: assessment.assessedAt,
                updatedAt: assessment.updatedAt,
              }
            : null;
        const scoreStatus = status === "SELESAI" ? "SELESAI" : "BELUM_DINILAI";
        if (
          filter.evidenceStatus !== "ALL" &&
          filter.evidenceStatus !== status
        ) {
          continue;
        }
        if (filter.scoreStatus !== "ALL" && filter.scoreStatus !== scoreStatus) {
          continue;
        }
        rows.push({
          key: `${unit.id}:${period.program.id}`,
          unit,
          category: period.category,
          program: period.program,
          participationType: "WITH_EVIDENCE",
          status,
          reportId: report?.id ?? null,
          reportNotes: report?.notes ?? null,
          score,
        });
      }
    }
    const totalCombinations = unitIds.length * periods.length;
    const assessedWhere = {
      ...reportWhere,
      status: "APPROVED" as const,
      participationAssessment: { is: { percentage: { not: null } } },
    };
    const unassessedWhere = {
      ...reportWhere,
      status: "APPROVED" as const,
      OR: [
        { participationAssessment: { is: null } },
        { participationAssessment: { is: { percentage: null } } },
      ],
    };
    const countMatchingReports = (where: object) =>
      prisma.activityReport.count({ where });
    let total: number;
    if (filter.evidenceStatus === "ALL" && filter.scoreStatus === "ALL") {
      total = totalCombinations;
    } else if (filter.evidenceStatus === "SELESAI") {
      total =
        filter.scoreStatus === "BELUM_DINILAI"
          ? 0
          : await countMatchingReports(assessedWhere);
    } else if (filter.evidenceStatus === "APPROVED_BELUM_DINILAI") {
      total =
        filter.scoreStatus === "SELESAI"
          ? 0
          : await countMatchingReports(unassessedWhere);
    } else if (
      filter.evidenceStatus === "PENDING" ||
      filter.evidenceStatus === "REJECTED"
    ) {
      total =
        filter.scoreStatus === "SELESAI"
          ? 0
          : await countMatchingReports({
              ...reportWhere,
              status: filter.evidenceStatus,
            });
    } else if (filter.evidenceStatus === "BELUM_UPLOAD") {
      total =
        filter.scoreStatus === "SELESAI"
          ? 0
          : totalCombinations -
            (await countMatchingReports(reportWhere));
    } else if (filter.scoreStatus === "SELESAI") {
      total = await countMatchingReports(assessedWhere);
    } else {
      total = totalCombinations - (await countMatchingReports(assessedWhere));
    }
    return NextResponse.json(
      successResponse(
        {
          data: rows,
          pagination: {
            page: filter.page,
            limit: filter.limit,
            total,
            totalPages: Math.ceil(total / filter.limit),
          },
        },
        "Berhasil mengambil laporan partisipasi",
      ),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/participation");
  }
}
