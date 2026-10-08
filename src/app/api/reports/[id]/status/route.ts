import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { usesDirectAdminScore } from "@/lib/program-capabilities";
import { assessParticipationScoreInTransaction } from "@/lib/participation-assessment";
import { errorResponse, formatZodError, successResponse } from "@/lib/response";
import { reviewReportSchema } from "@/schemas/report.schema";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const parsedData = reviewReportSchema.safeParse(await req.json());

    if (!parsedData.success) {
      const errorMessage = formatZodError(parsedData.error);
      return NextResponse.json(
        errorResponse(
          `Validasi gagal: ${errorMessage}`,
          400,
          z.treeifyError(parsedData.error),
        ),
        { status: 400 },
      );
    }

    const { status, notes, percentage } = parsedData.data;
    const reviewNotes = status === "REJECTED" ? notes?.trim() ?? null : null;

    const report = await prisma.$transaction(async (tx) => {
      const transition = await tx.activityReport.updateMany({
        where: { id, status: "PENDING" },
        data: { status, notes: reviewNotes },
      });

      if (transition.count !== 1) {
        throw new ApiError(
          "Laporan tidak ditemukan atau statusnya sudah berubah",
          409,
        );
      }

      const transitionedReport = await tx.activityReport.findUnique({
        where: { id },
        select: {
          id: true,
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
        },
      });

      if (!transitionedReport) {
        throw new Error("Laporan hasil transisi tidak ditemukan");
      }

      const requiresScore =
        status === "APPROVED" &&
        transitionedReport.program?.category &&
        usesDirectAdminScore(transitionedReport.program.category);
      if (requiresScore) {
        if (percentage === undefined) {
          throw new ApiError("Nilai partisipasi wajib diisi sebelum menyetujui laporan", 400);
        }
        await assessParticipationScoreInTransaction({
          reportId: id,
          actorId: session.user.id,
          actorName: session.user.name,
          percentage,
        }, tx);
      } else if (percentage !== undefined) {
        throw new ApiError("Nilai partisipasi tidak berlaku untuk laporan ini", 400);
      }

      await tx.activityLog.create({
        data: {
          reportId: id,
          action: status,
          notes: reviewNotes,
          actorId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
        },
      });

      return transitionedReport;
    });

    return NextResponse.json(
      successResponse(
        { reportId: report.id, status: report.status, nextAction: null },
        "Laporan berhasil diperbarui",
      ),
    );
  } catch (error) {
    return handleApiError(error, "PATCH /api/reports/[id]/status");
  }
}
