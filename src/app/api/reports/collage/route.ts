import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import {
  buildPicCollagePhotoWhere,
  collageGalleryQuerySchema,
  getExactPicUnitId,
} from "@/lib/api/collage";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const unitId = getExactPicUnitId(session.user);
    const parsed = collageGalleryQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(
          parsed.error.issues[0]?.message || "Parameter tidak valid",
          400,
        ),
        { status: 400 },
      );
    }

    const { programId, page, limit } = parsed.data;
    const where = buildPicCollagePhotoWhere(unitId, programId);

    const [photos, total] = await Promise.all([
      prisma.activityPhoto.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ report: { tanggalKegiatan: "desc" } }, { id: "desc" }],
        select: {
          id: true,
          imageUrl: true,
          originalName: true,
          report: {
            select: {
              id: true,
              activityName: true,
              tanggalKegiatan: true,
              lokasi: true,
              createdBy: { select: { name: true } },
            },
          },
        },
      }),
      prisma.activityPhoto.count({ where }),
    ]);

    return NextResponse.json(
      successResponse({
        items: photos.map((photo) => ({
          id: photo.id,
          imageUrl: photo.imageUrl,
          originalName: photo.originalName,
          report: {
            id: photo.report.id,
            activityName: photo.report.activityName,
            tanggalKegiatan: photo.report.tanggalKegiatan,
            lokasi: photo.report.lokasi,
            picName: photo.report.createdBy?.name || "-",
          },
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/collage");
  }
}
