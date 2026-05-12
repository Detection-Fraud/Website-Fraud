import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

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
    const { status, notes } = body;

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

    if (status === "REJECTED" && (!notes || notes.trim().length < 10)) {
      return NextResponse.json(
        errorResponse("Catatan penolakan wajib diisi minimal 10 karakter", 400),
        { status: 400 },
      );
    }

    const updatedReport = await prisma.activityReport.update({
      where: { id },
      data: {
        status,
        notes: status === "REJECTED" ? notes : null,
      },
    });

    return NextResponse.json(
      successResponse(updatedReport, "Laporan berhasil diperbarui"),
    );
  } catch (error) {
    console.error("ERROR PUT /api/reports/[id]:", error);
    return NextResponse.json(errorResponse("Gagal memperbarui laporan", 500), {
      status: 500,
    });
  }
}
