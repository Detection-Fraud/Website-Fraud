import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { usesDirectAdminScore } from "@/lib/program-capabilities";
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

    const { status, notes } = parsedData.data;
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

      return transitionedReport;
    });

    const category = report.program?.category;
    const nextAction =
      status === "APPROVED" && category && usesDirectAdminScore(category)
        ? { type: "ENTER_PARTICIPATION_SCORE" as const, reportId: report.id }
        : null;

    return NextResponse.json(
      successResponse(
        { reportId: report.id, status: report.status, nextAction },
        "Laporan berhasil diperbarui",
      ),
    );
  } catch (error) {
    return handleApiError(error, "PATCH /api/reports/[id]/status");
  }
}
