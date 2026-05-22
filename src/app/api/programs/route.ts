import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const whereClause: any = user.role === "ADMIN" ? {} : { isActive: true };

    if (search) {
      whereClause.name = { contains: search, mode: "insensitive" };
    }

    const [programs, activeCount, inactiveCount, totalCount, filteredCount, categoryCount, uncategorizedCount] =
      await Promise.all([
        prisma.programBudaya.findMany({
          where: whereClause,
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
          skip,
          take: limit,
          include: {
            category: true,
          },
        }),
        prisma.programBudaya.count({
          where: { isActive: true },
        }),
        prisma.programBudaya.count({
          where: { isActive: false },
        }),
        prisma.programBudaya.count(),
        prisma.programBudaya.count({ where: whereClause }),
        prisma.programCategory.count(), // <-- Hitung Total Kategori
        prisma.programBudaya.count({    // <-- Hitung Tidak Berkategori
          where: { categoryId: null },
        }),
      ]);

    return NextResponse.json(
      {
        success: true,
        message: "Berhasil mengambil data program budaya",
        data: programs,

        summary: {
          active: activeCount,
          inActive: inactiveCount,
          total: totalCount,
          totalCategory: categoryCount,
          uncategorized: uncategorizedCount,
        },
        pagination: {
          total: filteredCount,
          page,
          limit,
          totalPages: Math.ceil(filteredCount / limit),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(errorResponse("Gagal mengambil data program"), {
      status: 500,
    });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const body = await req.json();

    const { name, frequency, startDate, endDate, categoryId, description } =
      body;

    if (!name || !frequency || !startDate || !endDate) {
      return NextResponse.json(errorResponse("Missing required fields", 400), {
        status: 400,
      });
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json(
        errorResponse("End date must be after start date", 400),
        {
          status: 400,
        },
      );
    }

    const program = await prisma.programBudaya.create({
      data: {
        name,
        frequency: parseInt(frequency),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true,
        categoryId: categoryId || null,
        description: description || null,
      },
    });

    return NextResponse.json(
      successResponse(program, "Program budaya berhasil ditambahkan", 201),
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(errorResponse("Failed to add program"), {
      status: 500,
    });
  }
}
