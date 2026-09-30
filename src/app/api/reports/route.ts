import {
  ApiError,
  handleApiError,
  requireAuth,
  requirePic,
} from "@/lib/api/auth-guard";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { resolveScope } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import {
  isActivityDateInsideProgram,
  isProgramUploadOpen,
} from "@/lib/program-period";
import {
  getCapabilityError,
  requiresEvidence,
} from "@/lib/program-capabilities";
import { errorResponse, formatZodError, successResponse } from "@/lib/response";
import { programPurposeSchema } from "@/schemas/category-query.schema";
import { createReportSchema } from "@/schemas/report.schema";
import {
  createServerOwnedUploadContext,
  findUploadReferences,
  getUploadLifecycleTransaction,
  readVerifiedNewUpload,
  rollbackVerifiedNewUpload,
  UploadLifecycleError,
  verifyNewUpload,
  withUploadLifecycleTransaction,
  type VerifiedNewUpload,
} from "@/lib/api/upload-lifecycle";
import { resolveUploadReference } from "@/lib/api/upload-storage";
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
    const sortMode = searchParams.get("sortMode");
    if (sortMode !== null && sortMode !== "APPROVAL") {
      return NextResponse.json(
        errorResponse("Sort mode laporan tidak valid", 400),
        { status: 400 },
      );
    }
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
    const sortOrder: Prisma.SortOrder =
      requestedSortOrder === "desc" ? "desc" : "asc";
    const orderBy: Prisma.ActivityReportOrderByWithRelationInput[] =
      sortMode === "APPROVAL"
        ? statusFilter === "PENDING"
          ? [{ lastSubmittedAt: "asc" }, { id: "asc" }]
          : [{ updatedAt: "desc" }, { id: "desc" }]
        : [{ createdAt: sortOrder }, { id: sortOrder }];

    const [total, reports] = await Promise.all([
      prisma.activityReport.count({ where: whereClause }),
      prisma.activityReport.findMany({
        where: whereClause,
        orderBy,
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

async function rollbackRequestUploads(uploads: VerifiedNewUpload[]): Promise<void> {
  const results = await Promise.allSettled(
    uploads.map((upload) => rollbackVerifiedNewUpload(prisma, upload)),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected" || result.value.kind === "failed") {
      const state = readVerifiedNewUpload(uploads[index]);
      console.error("[POST /api/reports] upload cleanup failed", {
        phase: "rollback-new-upload",
        fileKey: state.publicId,
      });
    }
  });
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { keyPrefix: "reports-submit", max: 20 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const verifiedUploads: VerifiedNewUpload[] = [];
  try {
    const session = await requirePic();
    const user = session.user;
    const unitId = user.unitId;
    if (!unitId) {
      return NextResponse.json(
        errorResponse("Akun PIC wajib terhubung dengan unit kerja yang valid", 403),
        { status: 403 },
      );
    }

    const activePic = await prisma.user.findFirst({
      where: { id: user.id, isActive: true, unitId },
      select: { id: true, unitId: true },
    });
    if (!activePic) {
      return NextResponse.json(errorResponse("Akun PIC atau unit kerja tidak aktif", 403), { status: 403 });
    }

    const parsedData = createReportSchema.safeParse(await request.json());
    if (!parsedData.success) {
      return NextResponse.json(
        errorResponse(`Validasi gagal: ${formatZodError(parsedData.error)}`, 400, z.treeifyError(parsedData.error)),
        { status: 400 },
      );
    }

    const { activityName, tanggalKegiatan, lokasi, description, programId, uploadedPhotos } = parsedData.data;
    const seen = new Set<string>();
    const uploadStates: Array<{ originalName: string; publicId: string; url: string; descriptor: string; cleanupToken: string }> = [];
    for (const photo of uploadedPhotos) {
      if (seen.has(photo.publicId)) throw new ApiError("Foto upload duplikat", 400);
      seen.add(photo.publicId);

      const context = createServerOwnedUploadContext({
        userId: user.id,
        purpose: "EVIDENCE",
        mode: "CREATE",
        publicId: photo.publicId,
        unitId,
      });
      const verified = verifyNewUpload(photo.descriptor, photo.cleanupToken, context);
      verifiedUploads.push(verified);
      const state = readVerifiedNewUpload(verified);
      const resolved = await resolveUploadReference(state.url);
      if (state.publicId !== photo.publicId || resolved.kind !== "local" || !resolved.exists || !resolved.isRegularFile || resolved.storageKey !== state.publicId) {
        throw new ApiError("File upload tidak tersedia", 400);
      }
      uploadStates.push({
        originalName: photo.originalName,
        publicId: state.publicId,
        url: state.url,
        descriptor: photo.descriptor,
        cleanupToken: photo.cleanupToken,
      });
    }

    const programData = await prisma.programBudaya.findUnique({ where: { id: programId }, include: { category: true } });
    if (!programData?.category) throw new ApiError("Program tidak ditemukan", 404);
    if (!programData.isActive) throw new ApiError("Program sedang tidak aktif", 400);
    const capabilityError = getCapabilityError(programData.category);
    if (capabilityError) throw new ApiError(capabilityError, 422);
    if (!requiresEvidence(programData.category)) throw new ApiError("Program ini tidak menerima unggahan bukti foto", 422);
    if (!isProgramUploadOpen(programData)) throw new ApiError("Jendela upload program sedang tertutup", 403);
    if (!isActivityDateInsideProgram(tanggalKegiatan, programData)) throw new ApiError("Tanggal kegiatan di luar periode program", 400);

    const result = await withUploadLifecycleTransaction(
      prisma,
      {
        entities: [
          { model: "ProgramBudaya", id: programId },
          { model: "Unit", id: unitId },
        ],
        fileKeys: uploadStates.map(({ publicId }) => publicId),
      },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        for (const photo of uploadStates) {
          if ((await findUploadReferences(lifecycle, photo.publicId)).length > 0) {
            throw new ApiError("File upload sudah digunakan", 409);
          }
        }

        const lockedProgram = await tx.programBudaya.findUnique({ where: { id: programId }, include: { category: true } });
        if (!lockedProgram?.category) throw new ApiError("Program tidak ditemukan", 404);
        if (!lockedProgram.isActive) throw new ApiError("Program sedang tidak aktif", 400);
        const lockedCapabilityError = getCapabilityError(lockedProgram.category);
        if (lockedCapabilityError) throw new ApiError(lockedCapabilityError, 422);
        if (!requiresEvidence(lockedProgram.category)) throw new ApiError("Program ini tidak menerima unggahan bukti foto", 422);
        if (!isProgramUploadOpen(lockedProgram)) throw new ApiError("Jendela upload program sedang tertutup", 403);
        if (!isActivityDateInsideProgram(tanggalKegiatan, lockedProgram)) throw new ApiError("Tanggal kegiatan di luar periode program", 400);

        if (lockedProgram.category.scoreInputMode === "DIRECT_ADMIN") {
          const duplicate = await tx.activityReport.findFirst({
            where: { unitId, programId },
            select: { id: true },
          });
          if (duplicate) throw new ApiError("Unit Anda sudah pernah mengunggah bukti untuk program ini", 409);
        }

        for (const photo of uploadStates) {
          const context = createServerOwnedUploadContext({
            userId: user.id,
            purpose: "EVIDENCE",
            mode: "CREATE",
            publicId: photo.publicId,
            unitId,
          });
          const verified = verifyNewUpload(photo.descriptor, photo.cleanupToken, context);
          const state = readVerifiedNewUpload(verified);
          const resolved = await resolveUploadReference(state.url);
          if (state.publicId !== photo.publicId || state.url !== photo.url || resolved.kind !== "local" || !resolved.exists || !resolved.isRegularFile || resolved.storageKey !== state.publicId) {
            throw new ApiError("File upload tidak tersedia", 400);
          }
        }

        const submittedAt = new Date();
        return tx.activityReport.create({
          data: {
            activityName,
            tanggalKegiatan: new Date(tanggalKegiatan),
            lokasi,
            description,
            programId,
            unitId,
            createdById: user.id,
            lastSubmittedAt: submittedAt,
            photos: {
              create: uploadStates.map(({ originalName, publicId, url }) => ({
                originalName,
                imageUrl: url,
                publicId,
              })),
            },
            logs: {
              create: {
                action: "SUBMITTED",
                createdAt: submittedAt,
                notes: null,
                actorId: user.id,
                actorName: user.name,
                actorRole: user.role,
              },
            },
          },
          include: { photos: true, createdBy: { select: { id: true, name: true } } },
        });
      },
    );
    return NextResponse.json(successResponse(result, "Laporan berhasil dibuat", 201), { status: 201 });
  } catch (error: unknown) {
    await rollbackRequestUploads(verifiedUploads);
    if (error instanceof UploadLifecycleError) {
      return NextResponse.json(errorResponse("Kredensial upload tidak valid", 400), { status: 400 });
    }
    return handleApiError(error, "POST /api/reports");
  }
}
