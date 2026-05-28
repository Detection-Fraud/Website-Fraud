import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, color } = body;

    const category = await prisma.programCategory.update({
      where: { id },
      data: { name, color },
    });

    return NextResponse.json(
      successResponse(category, "success update category"),
      { status: 200 },
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(errorResponse("Internal Server Error", 500), {
      status: 500,
    });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const { id } = await params;

    const programCount = await prisma.programBudaya.count({
      where: { categoryId: id },
    });

    if (programCount > 0) {
      return NextResponse.json(
        errorResponse("Cannot delete category because it has programs", 400),
        { status: 400 },
      );
    }

    await prisma.programCategory.delete({
      where: { id },
    });

    return NextResponse.json(successResponse(null, "success delete category"), {
      status: 200,
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json(errorResponse("Internal Server Error", 500), {
      status: 500,
    });
  }
}
