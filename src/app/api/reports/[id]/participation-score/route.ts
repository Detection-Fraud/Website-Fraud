import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { assessParticipationScore } from "@/lib/participation-assessment";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { participationScoreSchema } from "@/schemas/participation-score.schema";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id: reportId } = await params;

    const report = await prisma.activityReport.findUnique({
      where: { id: reportId },
      select: {
        status: true,
        program: {
          select: {
            category: {
              select: {
                targetUnit: true,
                evidenceMode: true,
                scoreInputMode: true,
              },
            },
          },
        },
        participationAssessment: {
          select: {
            id: true,
            percentage: true,
            tw: true,
            year: true,
            unitId: true,
            evidenceReportId: true,
            assessedAt: true,
            updatedAt: true,
            assessedBy: { select: { id: true, name: true } },
            scoreHistories: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                action: true,
                previousPercentage: true,
                newPercentage: true,
                changeReason: true,
                actorId: true,
                actorName: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!report || !report.program || !report.program.category) {
      throw new ApiError("Laporan tidak ditemukan", 404);
    }

    if (report.status !== "APPROVED") {
      throw new ApiError(
        "Penilaian hanya tersedia untuk laporan yang telah disetujui (APPROVED)",
        409,
      );
    }

    const category = report.program.category;
    if (
      category.targetUnit !== "PARTISIPASI_PERSEN" ||
      category.evidenceMode !== "PHOTO_WITHOUT_AI" ||
      category.scoreInputMode !== "DIRECT_ADMIN"
    ) {
      throw new ApiError(
        "Kategori ini tidak mendukung penilaian langsung oleh admin",
        422,
      );
    }

    const assessment = report.participationAssessment;
    const dto = {
      scoreStatus:
        assessment?.percentage === null || assessment === null
          ? ("MENUNGGU_NILAI" as const)
          : ("SUDAH_DINILAI" as const),
      assessment: assessment
        ? {
            id: assessment.id,
            percentage: assessment.percentage,
            tw: assessment.tw,
            year: assessment.year,
            unitId: assessment.unitId,
            evidenceReportId: assessment.evidenceReportId,
            assessedAt: assessment.assessedAt,
            assessedBy: assessment.assessedBy
              ? {
                  id: assessment.assessedBy.id,
                  name: assessment.assessedBy.name,
                }
              : null,
            updatedAt: assessment.updatedAt,
            scoreHistories: assessment.scoreHistories.map((history) => ({
              id: history.id,
              action: history.action,
              previousPercentage: history.previousPercentage,
              newPercentage: history.newPercentage,
              changeReason: history.changeReason,
              actorId: history.actorId,
              actorName: history.actorName,
              createdAt: history.createdAt,
            })),
          }
        : null,
    };

    return NextResponse.json(
      successResponse(dto, "Berhasil mengambil data penilaian"),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/[id]/participation-score");
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id: reportId } = await params;

    const parsed = participationScoreSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(
          "Validasi input nilai gagal",
          400,
          z.treeifyError(parsed.error),
        ),
        { status: 400 },
      );
    }

    const result = await assessParticipationScore({
      reportId,
      actorId: session.user.id,
      actorName: session.user.name,
      percentage: parsed.data.percentage,
      changeReason: parsed.data.changeReason,
      expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    });

    return NextResponse.json(
      successResponse(result, "Nilai partisipasi berhasil disimpan"),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "PUT /api/reports/[id]/participation-score");
  }
}
