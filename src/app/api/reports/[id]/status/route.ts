import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, formatZodError, successResponse } from "@/lib/response";
import { reviewReportSchema } from "@/schemas/report.schema";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(errorResponse("Unauthorized", 401), {
      status: 401,
    });
  }

  try {
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
    console.error("ERROR Patch /api/reports/[id]:", error);
    return NextResponse.json(errorResponse("Gagal memperbarui laporan", 500), {
      status: 500,
    });
  }
}
