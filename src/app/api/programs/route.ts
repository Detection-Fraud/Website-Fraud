import {
  ApiError,
  handleApiError,
  requireAdmin,
  requireAuth,
} from "@/lib/api/auth-guard";
import {
  getCapabilityError,
  usesDirectAdminScore,
} from "@/lib/program-capabilities";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { createProgramSchema } from "@/schemas/program.schema";
import { Prisma } from "@generated/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const programQuerySchema = z.object({
  search: z.string().optional().default(""),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  targetUnit: z.enum(["KEGIATAN", "PARTISIPASI_PERSEN", "ALL"]).optional(),
  purpose: z.enum(["EVIDENCE", "ALL"]).optional(),
  categoryId: z.string().optional(),
  tw: z.enum(["1", "2", "3", "4", "ALL"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().default("ALL"),
});

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const user = session.user;

    const { searchParams } = new URL(req.url);
    const parsedQuery = programQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    if (!parsedQuery.success) {
      return NextResponse.json(
        errorResponse(
          "Parameter query tidak valid",
          400,
          z.treeifyError(parsedQuery.error),
        ),
        { status: 400 },
      );
    }

    const { search, page, limit, targetUnit, purpose, categoryId, tw, status } =
      parsedQuery.data;
    const skip = (page - 1) * limit;

    // UPDATED: filter kategori aman & typed
    const categoryWhere: Prisma.ProgramCategoryWhereInput = {
      ...(purpose === "EVIDENCE" ? { evidenceMode: { not: "NONE" } } : {}),
      ...(targetUnit && targetUnit !== "ALL" ? { targetUnit } : {}),
    };

    const baseCategoryFilter: Prisma.ProgramBudayaWhereInput = {
      ...(Object.keys(categoryWhere).length > 0
        ? { category: categoryWhere }
        : {}),
      ...(categoryId && categoryId !== "ALL" && { categoryId }),
      ...(tw && tw !== "ALL" && { tw: parseInt(tw) }),
    };

    const baseWhere: Prisma.ProgramBudayaWhereInput = {
      ...(user.role === "ADMIN"
        ? status === "ACTIVE"
          ? { isActive: true }
          : status === "INACTIVE"
            ? { isActive: false }
            : {}
        : { isActive: true }),
      ...baseCategoryFilter,
    };

    const whereClause: Prisma.ProgramBudayaWhereInput = {
      ...baseWhere,
      ...(search && { name: { contains: search, mode: "insensitive" } }),
    };

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
      prisma.programBudaya.count({ where: { ...baseWhere, isActive: true } }),
      prisma.programBudaya.count({ where: { ...baseWhere, isActive: false } }),
      prisma.programBudaya.count({ where: whereClause }),
      prisma.programCategory.count(),
      prisma.programBudaya.count({ where: { categoryId: null } }),
    ]);

    return NextResponse.json(
      successResponse(
        {
          data: programs,
          summary: {
            active: activeCount,
            inActive: inactiveCount,
            total: activeCount + inactiveCount,
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
    const parsedData = createProgramSchema.safeParse(await req.json());

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
      uploadDeadline,
      categoryId,
      description,
      bannerUrl,
    } = parsedData.data;

    let targetFrequency = frequency;

    // UPDATED: Transaksi interaktif atomik untuk validasi kapabilitas & duplicate check (Blocker 1)
    const program = await prisma.$transaction(
      async (tx) => {
        if (categoryId) {
          const category = await tx.programCategory.findUnique({
            where: { id: categoryId },
          });
          if (!category) {
            throw new ApiError("Kategori tidak ditemukan", 404);
          }
          const capabilityError = getCapabilityError(category);
          if (capabilityError) {
            throw new ApiError(capabilityError, 422);
          }
          const isDirectAdmin = usesDirectAdminScore(category);
          if (isDirectAdmin) {
            if (tw === null || tw < 1 || tw > 4) {
              throw new ApiError(
                "Program penilaian langsung wajib memiliki TW 1-4",
                422,
              );
            }
            targetFrequency = 1;
            const normalizedStartDate = new Date(startDate);
            const year = normalizedStartDate.getUTCFullYear();
            await tx.$queryRaw(
              Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`direct-program:${categoryId}:${year}:${tw}`}))::text`,
            );
            const duplicate = await tx.programBudaya.findFirst({
              where: {
                categoryId,
                tw,
                startDate: {
                  gte: new Date(Date.UTC(year, 0, 1)),
                  lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
                },
              },
              select: { id: true },
            });
            if (duplicate) {
              throw new ApiError(
                "Program penilaian langsung untuk kategori, tahun, dan TW ini sudah ada",
                409,
              );
            }
          }
        }

        return await tx.programBudaya.create({
          data: {
            name,
            frequency: targetFrequency,
            tw: tw ?? null,
            startDate,
            endDate,
            uploadDeadline,
            isActive: true,
            categoryId: categoryId || null,
            description: description || null,
            bannerUrl: bannerUrl || null,
          },
          include: { category: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      successResponse(program, "Program budaya berhasil ditambahkan", 201),
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/programs");
  }
}
