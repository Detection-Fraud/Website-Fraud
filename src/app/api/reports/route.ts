import { ApiError, handleApiError, requireAuth, requirePic } from "@/lib/api/auth-guard";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { resolveScope } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import {
  isActivityDateInsideProgram,
  isProgramUploadOpen,
} from "@/lib/program-period";
import { getCapabilityError, requiresEvidence } from "@/lib/program-capabilities";
import { errorResponse, formatZodError, successResponse } from "@/lib/response";
import { programPurposeSchema } from "@/schemas/category-query.schema";
import { createReportSchema } from "@/schemas/report.schema";
import { UploadedPhoto } from "@/types/photo.types";
import { Prisma, ReportStatus } from "@generated/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const user = session.user;
    const searchParams = request.nextUrl.searchParams;
    const purposeResult = programPurposeSchema.safeParse(
      searchParams.get("purpose") ?? undefined,
    );
    if (!purposeResult.success) {
      return NextResponse.json(
        errorResponse(
          "Purpose laporan tidak valid",
          400,
          z.treeifyError(purposeResult.error),
        ),
        { status: 400 },
      );
    }
    const purpose = purposeResult.data;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "10"));
    const search = searchParams.get("search") || "";
    const statusFilter = searchParams.get("status") || "ALL";
    const kanwilFilter = searchParams.get("kanwilId") || "ALL";
    const kancabFilter = searchParams.get("kancabId") || "ALL";
    const divisiFilter = searchParams.get("divisiId") || "ALL";
    const categoryId = searchParams.get("categoryId") || "ALL";
    const programId = searchParams.get("programId") || "ALL";

    const { whereClause: unitScope } = await resolveScope(user, {
      kanwilId: kanwilFilter,
      kancabId: kancabFilter,
      divisiId: divisiFilter,
    });
    const programFilter: Prisma.ActivityReportWhereInput["program"] =
      purpose === "EVIDENCE"
        ? {
            category: { evidenceMode: { not: "NONE" } },
            ...(categoryId !== "ALL" && { categoryId }),
            ...(programId !== "ALL" && { id: programId }),
          }
        : {
            category: { targetUnit: "KEGIATAN" },
            ...(categoryId !== "ALL" && { categoryId }),
            ...(programId !== "ALL" && { id: programId }),
          };
    const whereClause: Prisma.ActivityReportWhereInput = {
      ...unitScope,
      program: programFilter,
    };
    const baseWhereClause = { ...whereClause };

    if (search) {
      whereClause.OR = [
        { activityName: { contains: search, mode: "insensitive" } },
        { lokasi: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { program: { name: { contains: search, mode: "insensitive" } } },
        { createdBy: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const ALLOWED_STATUSES = ["PENDING", "APPROVED", "REJECTED"];
    if (statusFilter !== "ALL") {
      if (!ALLOWED_STATUSES.includes(statusFilter)) {
        return NextResponse.json(
          errorResponse("Status laporan tidak valid", 400),
          { status: 400 },
        );
      }
      whereClause.status = statusFilter as ReportStatus;
    }

    const statusCounts = await prisma.activityReport.groupBy({
      by: ["status"],
      where: baseWhereClause,
      _count: true,
    });
    let summaryTotal = 0;
    let summaryPending = 0;
    let summaryApproved = 0;
    let summaryRejected = 0;
    for (const group of statusCounts) {
      summaryTotal += group._count;
      if (group.status === "PENDING") summaryPending = group._count;
      if (group.status === "APPROVED") summaryApproved = group._count;
      if (group.status === "REJECTED") summaryRejected = group._count;
    }

    const skip = (page - 1) * limit;
    const requestedSortOrder = searchParams.get("sortOrder");
    const sortOrder = requestedSortOrder === "desc" ? "desc" : "asc";
    const [total, reports] = await Promise.all([
      prisma.activityReport.count({ where: whereClause }),
      prisma.activityReport.findMany({
        where: whereClause,
        orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              type: true,
              parent: { select: { id: true, name: true } },
            },
          },
          program: {
            select: {
              name: true,
              id: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  targetUnit: true,
                  evidenceMode: true,
                  scoreInputMode: true,
                },
              },
            },
          },
          createdBy: { select: { id: true, name: true } },
          photos: {
            select: { id: true, originalName: true, imageUrl: true },
          },
        },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json(
      successResponse(
        {
          data: reports,
          summary: {
            total: summaryTotal,
            pending: summaryPending,
            approved: summaryApproved,
            rejected: summaryRejected,
          },
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        "Berhasil mengambil data laporan",
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports");
  }
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { keyPrefix: "reports-submit", max: 20 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  try {
    const session = await requirePic();
    const user = session.user;

    if (!user.unitId) {
      return NextResponse.json(
        errorResponse("Akun PIC wajib terhubung dengan unit kerja yang valid", 403),
        { status: 403 },
      );
    }

    const activePic = await prisma.user.findFirst({
      where: { id: user.id, isActive: true, unitId: user.unitId },
      select: { id: true, unitId: true },
    });
    if (!activePic) {
      return NextResponse.json(
        errorResponse("Akun PIC atau unit kerja tidak aktif", 403),
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsedData = createReportSchema.safeParse(body);

    if (!parsedData.success) {
      const errorMessage = formatZodError(parsedData.error);
      return NextResponse.json(
        errorResponse(`Validasi gagal: ${errorMessage}`, 400, z.treeifyError(parsedData.error)),
        { status: 400 },
      );
    }

    const {
      activityName,
      tanggalKegiatan,
      lokasi,
      description,
      programId,
      uploadedPhotos,
    } = parsedData.data;

    const programData = await prisma.programBudaya.findUnique({
      where: { id: programId },
      include: { category: true },
    });

    if (!programData || !programData.category) {
      return NextResponse.json(errorResponse("Program tidak ditemukan", 404), { status: 404 });
    }

    if (!programData.isActive) {
      return NextResponse.json(errorResponse("Program sedang tidak aktif", 400), { status: 400 });
    }

    const capabilityError = getCapabilityError(programData.category);
    if (capabilityError) {
      return NextResponse.json(
        errorResponse(capabilityError, 422),
        { status: 422 },
      );
    }
    if (!requiresEvidence(programData.category)) {
      return NextResponse.json(
        errorResponse("Program ini tidak menerima unggahan bukti foto", 422),
        { status: 422 },
      );
    }

    if (!isProgramUploadOpen(programData)) {
      return NextResponse.json(
        errorResponse("Jendela upload program sedang tertutup", 403),
        { status: 403 },
      );
    }

    if (!isActivityDateInsideProgram(tanggalKegiatan, programData)) {
      return NextResponse.json(
        errorResponse("Tanggal kegiatan di luar periode program", 400),
        { status: 400 },
      );
    }

    const category = programData.category;

    const result = await prisma.$transaction(async (tx) => {
      if (category.scoreInputMode === "DIRECT_ADMIN") {
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`direct-report:${user.unitId}:${programId}`}))::text`,
        );
        const existingReport = await tx.activityReport.findFirst({
          where: { unitId: user.unitId, programId },
          select: { id: true },
        });

        if (existingReport) {
          throw new ApiError("Unit Anda sudah pernah mengunggah bukti untuk program ini", 409);
        }
      }

      return await tx.activityReport.create({
        data: {
          activityName,
          tanggalKegiatan: new Date(tanggalKegiatan),
          lokasi,
          description,
          programId,
          unitId: user.unitId!,
          createdById: user.id,
          photos: {
            create:
              uploadedPhotos?.map((photo: UploadedPhoto) => ({
                originalName: photo.originalName,
                imageUrl: photo.imageUrl,
              })) || [],
          },
          logs: {
            create: {
              action: "SUBMITTED",
              notes: null,
              actorId: user.id,
              actorName: user.name,
              actorRole: user.role,
            },
          },
        },
        include: {
          photos: true,
          createdBy: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json(successResponse(result, "Laporan berhasil dibuat", 201), {
      status: 201,
    });
  } catch (error: unknown) {
    return handleApiError(error, "POST /api/reports");
  }
}
