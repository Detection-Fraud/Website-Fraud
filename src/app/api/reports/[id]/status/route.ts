import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
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
    const body = await req.json();

    const parsedData = reviewReportSchema.safeParse(body);

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

    const currentReport = await prisma.activityReport.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!currentReport) {
      return NextResponse.json(errorResponse("Laporan tidak ditemukan", 404));
    }

    if (currentReport.status !== "PENDING") {
      return NextResponse.json(
        errorResponse(
          "Hanya laporan dengan status PENDING yang dapat diubah",
          400,
        ),
        { status: 400 },
      );
    }

    const [updatedReport, log] = await prisma.$transaction([
      prisma.activityReport.update({
        where: { id },
        data: { status, notes: status === "REJECTED" ? notes : null },
      }),
      prisma.activityLog.create({
        data: {
          reportId: id,
          action: status === "APPROVED" ? "APPROVED" : "REJECTED",
          notes: status === "REJECTED" ? notes : null,

          actorId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
        },
      }),
    ]);

    return NextResponse.json(
      successResponse(updatedReport, "Laporan berhasil diperbarui"),
    );
  } catch (error) {
    return handleApiError(error, "PATCH /api/reports/[id]/status");
  }
}
