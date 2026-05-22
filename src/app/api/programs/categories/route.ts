import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const categories = await prisma.programCategory.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        programs: {
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            name: true,
            isActive: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    const mappedCategories = categories.map((cat) => {
      const totalProgram = cat.programs.length;
      const totalActive = cat.programs.filter((p) => p.isActive).length;
      const totalInActive = totalProgram - totalActive;

      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        totalProgram,
        totalActive,
        totalInActive,
        programs: cat.programs,
      };
    });

    const [totalCategory, totalPrograms, activePrograms, uncategorized] =
      await Promise.all([
        prisma.programCategory.count(),
        prisma.programBudaya.count(),
        prisma.programBudaya.count({ where: { isActive: true } }),
        prisma.programBudaya.count({ where: { categoryId: null } }),
      ]);
    return NextResponse.json(
      {
        success: true,
        message: "Berhasil mengambil data kategori",
        data: mappedCategories,
        summary: {
          totalCategory,
          totalPrograms,
          activePrograms,
          uncategorized,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(errorResponse("Internal Server Error", 500), {
      status: 500,
    });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        errorResponse("Unauthorized, You do not have access", 401),
        { status: 401 },
      );
    }

    const body = await req.json();
    const { name, color } = body;

    if (!name || !color) {
      return NextResponse.json(
        errorResponse("Name and color is required", 400),
        { status: 400 },
      );
    }

    const exists = await prisma.programCategory.findUnique({
      where: { name },
    });

    if (exists) {
      return NextResponse.json(errorResponse("Category already exists", 400), {
        status: 400,
      });
    }

    const category = await prisma.programCategory.create({
      data: {
        name,
        color,
      },
    });

    return NextResponse.json(
      successResponse(category, "success create category"),
      { status: 201 },
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(errorResponse("Internal Server Error", 500), {
      status: 500,
    });
  }
}
