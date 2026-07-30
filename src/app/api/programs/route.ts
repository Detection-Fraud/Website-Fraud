import {
  handleApiError,
  requireAdmin,
  requireAuth,
} from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { createProgramSchema } from "@/schemas/program.schema";
import { Prisma } from "@generated/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const user = session.user;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ProgramBudayaWhereInput =
      user.role === "ADMIN" ? {} : { isActive: true };

    if (search) {
      whereClause.name = { contains: search, mode: "insensitive" };
    }

    const [
      programs,
      activeCount,
      inactiveCount,
      filteredCount,
      categoryCount,
      uncategorizedCount,
    ] = await Promise.all([
      prisma.programBudaya.findMany({
        where: whereClause,
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: { category: true },
      }),
      prisma.programBudaya.count({ where: { isActive: true } }),
      prisma.programBudaya.count({ where: { isActive: false } }),
      prisma.programBudaya.count({ where: whereClause }),
      prisma.programCategory.count(),
      prisma.programBudaya.count({ where: { categoryId: null } }),
    ]);

    const totalCount = activeCount + inactiveCount;

    return NextResponse.json(
      successResponse(
        {
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
        "Berhasil mengambil data program budaya",
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/programs");
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();

    const parsedData = createProgramSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json(
        errorResponse(
          "Validasi input gagal",
          400,
          z.treeifyError(parsedData.error),
        ),
        { status: 400 },
      );
    }
    const {
      name,
      frequency,
      tw,
      startDate,
      endDate,
      categoryId,
      description,
      bannerUrl,
    } = parsedData.data;

    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json(
        errorResponse("Tanggal selesai harus setelah tanggal mulai", 400),
        {
          status: 400,
        },
      );
    }

    const program = await prisma.programBudaya.create({
      data: {
        name,
        frequency,
        tw: tw ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true,
        categoryId: categoryId || null,
        description: description || null,
        bannerUrl: bannerUrl || null,
      },
    });

    return NextResponse.json(
      successResponse(program, "Program budaya berhasil ditambahkan", 201),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/programs");
  }
}
