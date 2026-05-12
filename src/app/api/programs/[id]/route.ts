import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    const user = session?.user;

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const { isActive } = await req.json();

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        errorResponse("Format status tidak valid", 400),
        { status: 400 },
      );
    }

    const program = await prisma.programBudaya.update({
      where: { id },
      data: { isActive },
    });

    const statusText = isActive ? "diaktifkan" : "dinonaktifkan";

    return NextResponse.json(
      successResponse(program, `Program ${statusText} berhasil`),
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(errorResponse("Gagal mengubah status program"), {
      status: 500,
    });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await auth();
    const user = session?.user;

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const body = await req.json();
    const { name, frequency, startDate, endDate } = body;

    if (!name || !frequency || !startDate || !endDate) {
      return NextResponse.json(errorResponse("Missing required fields", 400), {
        status: 400,
      });
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json(
        errorResponse("End date must be after start date", 400),
        { status: 400 },
      );
    }

    const program = await prisma.programBudaya.update({
      where: { id },
      data: {
        name,
        frequency: parseInt(frequency),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    return NextResponse.json(
      successResponse(program, "Program berhasil diupdate"),
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(errorResponse("Gagal mengupdate program"), {
      status: 500,
    });
  }
}
