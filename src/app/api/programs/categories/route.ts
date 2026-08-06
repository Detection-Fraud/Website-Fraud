import {
  handleApiError,
  requireAdmin,
  requireAuth,
} from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { createCategorySchema } from "@/schemas/program.schema";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const targetUnit = searchParams.get("targetUnit");

    const whereClause: any = {};
    if (targetUnit) {
      whereClause.targetUnit = targetUnit;
    }

    const categories = await prisma.programCategory.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
      include: {
        programs: {
          select: { id: true, name: true, isActive: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const mapped = categories.map((cat) => ({
      ...cat,
      totalProgram: cat.programs.length,
      totalActive: cat.programs.filter((p) => p.isActive).length,
    }));

    return NextResponse.json(
      {
        success: true,
        message: "Berhasil mengambil data kategori",
        data: mapped,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/programs/categories");
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse("Validasi gagal", 400, z.treeifyError(parsed.error)),
        { status: 400 },
      );
    }

    const { name, color, bannerUrl, targetUnit, defaultFrequency } =
      parsed.data;

    const exists = await prisma.programCategory.findUnique({ where: { name } });
    if (exists) {
      return NextResponse.json(errorResponse("Kategori sudah ada", 409), {
        status: 409,
      });
    }

    const category = await prisma.programCategory.create({
      data: { name, color, bannerUrl, targetUnit, defaultFrequency },
    });

    return NextResponse.json(
      successResponse(category, "success create category"),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/programs/categories");
  }
}
