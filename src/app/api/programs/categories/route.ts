import {
  getCategoryLocks,
  getCategoryUsageByCategoryIds,
} from "@/lib/api/category-usage";
import {
  handleApiError,
  requireAdmin,
  requireAuth,
} from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { categoryQuerySchema } from "@/schemas/category-query.schema";
import { createCategorySchema } from "@/schemas/program.schema";
import { Prisma } from "@generated/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    await requireAuth();

    const query = categoryQuerySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams.entries()),
    );
    if (!query.success) {
      return NextResponse.json(
        errorResponse(
          "Filter kategori tidak valid",
          400,
          z.treeifyError(query.error),
        ),
        { status: 400 },
      );
    }

    const where: Prisma.ProgramCategoryWhereInput = {};
    if (query.data.targetUnit !== undefined)
      where.targetUnit = query.data.targetUnit;
    if (query.data.evidenceMode !== undefined)
      where.evidenceMode = query.data.evidenceMode;
    if (query.data.scoreInputMode !== undefined)
      where.scoreInputMode = query.data.scoreInputMode;

    const categories = await prisma.programCategory.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        bannerUrl: true,
        targetUnit: true,
        defaultFrequency: true,
        evidenceMode: true,
        scoreInputMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const usageByCategoryId = await getCategoryUsageByCategoryIds(
      categories.map((category) => category.id),
    );

    const data = categories.map((category) => {
      const usage = usageByCategoryId.get(category.id);
      if (!usage) {
        throw new Error(`Missing usage aggregate for category ${category.id}`);
      }

      return {
        ...category,
        usage,
        locks: getCategoryLocks(usage),
        totalProgram: usage.programCount,
        totalActive: usage.activeProgramCount,
      };
    });

    return NextResponse.json(
      successResponse(data, "Berhasil mengambil data kategori"),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/programs/categories");
  }
}


export async function POST(req: Request) {
  try {
    await requireAdmin();
    const parsed = createCategorySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse("Validasi gagal", 400, z.treeifyError(parsed.error)),
        { status: 400 },
      );
    }

    const { name } = parsed.data;
    if (await prisma.programCategory.findUnique({ where: { name } })) {
      return NextResponse.json(errorResponse("Kategori sudah ada", 409), {
        status: 409,
      });
    }

    const category = await prisma.programCategory.create({ data: parsed.data });
    return NextResponse.json(
      successResponse(category, "success create category"),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/programs/categories");
  }
}
