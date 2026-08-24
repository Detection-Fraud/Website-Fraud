import { ApiError, handleApiError, requireAuth } from "@/lib/api/auth-guard";
import {
  adminCollageExportQuerySchema,
  buildAdminCollagePhotoWhere,
  buildPicCollagePhotoWhere,
  getExactPicUnitId,
  picCollageExportQuerySchema,
} from "@/lib/api/collage";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import { Prisma } from "@generated/prisma";
import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
const LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "assets",
  "images",
  "logo-bulog-full.png",
);

interface ExportPhoto {
  id: number;
  imageUrl: string;
  report: {
    activityName: string;
    tanggalKegiatan: Date;
    createdBy: { name: string } | null;
    program: { name: string } | null;
  };
}

function localPhotoPath(imageUrl: string) {
  if (!imageUrl.startsWith("/uploads/")) return null;
  const root = path.resolve(UPLOAD_DIR);
  const target = path.resolve(root, imageUrl.slice("/uploads/".length));
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return target;
}

async function readPhoto(imageUrl: string) {
  const filePath = localPhotoPath(imageUrl);
  if (!filePath) return null;
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}

function drawPageFrame(
  doc: PDFKit.PDFDocument,
  programName: string,
  unitName: string,
  currentPage: number,
  totalPages: number,
) {
  try {
    doc.image(LOGO_PATH, 470, 25, { width: 85 });
  } catch {}

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#1B4F88")
    .text("KOLASE FOTO KEGIATAN BUDAYA", 40, 25, { lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#475569")
    .text(`Program : ${programName}`, 40, 45, { lineBreak: false })
    .text(`Unit       : ${unitName}`, 40, 58, { lineBreak: false });
  doc
    .strokeColor("#1B4F88")
    .lineWidth(1.5)
    .moveTo(40, 74)
    .lineTo(555, 74)
    .stroke();
  doc
    .strokeColor("#cbd5e1")
    .lineWidth(0.5)
    .moveTo(40, 805)
    .lineTo(555, 805)
    .stroke();
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#94a3b8")
    .text("Dokumen Resmi Sistem Fraud Detection BULOG", 40, 812, {
      lineBreak: false,
    });
  doc
    .font("Helvetica-Bold")
    .fillColor("#64748b")
    .text(`Halaman ${currentPage} dari ${totalPages}`, 400, 812, {
      width: 155,
      align: "right",
      lineBreak: false,
    });
}

function drawPhotoCard(
  doc: PDFKit.PDFDocument,
  photo: ExportPhoto,
  image: Buffer | null,
  index: number,
) {
  const cardWidth = 235;
  const cardHeight = 295;
  const photoHeight = 215;
  const col = index % 2;
  const row = Math.floor(index / 2);
  const x = 40 + col * 255;
  const y = 88 + row * 315;
  const footerY = y + photoHeight;

  doc
    .roundedRect(x, y, cardWidth, cardHeight, 6)
    .lineWidth(1)
    .strokeColor("#e2e8f0")
    .stroke();
  doc
    .rect(x + 1, footerY, cardWidth - 2, cardHeight - photoHeight - 1)
    .fillColor("#f8fafc")
    .fill();
  doc
    .moveTo(x, footerY)
    .lineTo(x + cardWidth, footerY)
    .strokeColor("#e2e8f0")
    .stroke();

  if (image) {
    try {
      doc.image(image, x + 5, y + 5, {
        fit: [cardWidth - 10, photoHeight - 10],
        align: "center",
        valign: "center",
      });
    } catch {
      doc
        .fontSize(8)
        .fillColor("#94a3b8")
        .text("Format foto tidak didukung", x, y + 100, {
          width: cardWidth,
          align: "center",
        });
    }
  } else {
    doc
      .fontSize(8)
      .fillColor("#94a3b8")
      .text("Foto tidak tersedia", x, y + 100, {
        width: cardWidth,
        align: "center",
      });
  }

  const date = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(photo.report.tanggalKegiatan);

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#1e293b")
    .text(photo.report.activityName, x + 8, footerY + 8, {
      width: cardWidth - 16,
      height: 20,
      ellipsis: true,
    });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#64748b")
    .text(
      `${date} | PIC: ${photo.report.createdBy?.name || "-"}`,
      x + 8,
      footerY + 34,
      {
        width: cardWidth - 16,
        ellipsis: true,
      },
    );
}

async function renderPdf(
  doc: PDFKit.PDFDocument,
  photos: ExportPhoto[],
  programName: string,
  unitName: string,
) {
  const photosPerPage = 4;
  const totalPages = Math.ceil(photos.length / photosPerPage);

  for (let offset = 0; offset < photos.length; offset += photosPerPage) {
    if (offset > 0) doc.addPage();
    const pagePhotos = photos.slice(offset, offset + photosPerPage);
    const buffers = await Promise.all(
      pagePhotos.map((photo) => readPhoto(photo.imageUrl)),
    );

    drawPageFrame(
      doc,
      programName,
      unitName,
      Math.floor(offset / photosPerPage) + 1,
      totalPages,
    );
    pagePhotos.forEach((photo, index) =>
      drawPhotoCard(doc, photo, buffers[index], index),
    );
  }
}

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const params = Object.fromEntries(req.nextUrl.searchParams);

    let where: Prisma.ActivityPhotoWhereInput;
    let labelUnitId: string;
    let requestedProgramId: string | undefined;
    let requestedCategoryId: string | undefined;

    if (session.user.role === "PIC") {
      const parsed = picCollageExportQuerySchema.safeParse(params);
      if (!parsed.success) {
        return NextResponse.json(
          errorResponse(
            parsed.error.issues[0]?.message || "Parameter tidak valid",
            400,
          ),
          { status: 400 },
        );
      }
      labelUnitId = getExactPicUnitId(session.user);
      requestedProgramId = parsed.data.programId;
      where = buildPicCollagePhotoWhere(labelUnitId, requestedProgramId);
    } else if (session.user.role === "ADMIN") {
      const parsed = adminCollageExportQuerySchema.safeParse(params);
      if (!parsed.success) {
        return NextResponse.json(
          errorResponse(
            parsed.error.issues[0]?.message || "Parameter tidak valid",
            400,
          ),
          { status: 400 },
        );
      }
      const resolved = await buildAdminCollagePhotoWhere(parsed.data);
      where = resolved.where;
      labelUnitId = resolved.labelUnitId;
      requestedProgramId = parsed.data.programId;
      requestedCategoryId = parsed.data.categoryId;
    } else {
      throw new ApiError("Role tidak memiliki akses export kolase", 403);
    }

    const photos = await prisma.activityPhoto.findMany({
      where,
      orderBy: [{ report: { tanggalKegiatan: "desc" } }, { id: "desc" }],
      select: {
        id: true,
        imageUrl: true,
        report: {
          select: {
            activityName: true,
            tanggalKegiatan: true,
            createdBy: { select: { name: true } },
            program: { select: { name: true } },
          },
        },
      },
    });

    if (photos.length === 0) {
      return NextResponse.json(
        errorResponse("Belum ada foto approved untuk kriteria ini", 404),
        {
          status: 404,
        },
      );
    }

    const [unit, category] = await Promise.all([
      prisma.unit.findUnique({
        where: { id: labelUnitId },
        select: { name: true },
      }),
      requestedCategoryId && requestedCategoryId !== "ALL"
        ? prisma.programCategory.findUnique({
            where: { id: requestedCategoryId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

    const programName =
      requestedProgramId && requestedProgramId !== "ALL"
        ? photos[0].report.program?.name || "Program Budaya"
        : category?.name || "Program Budaya";
    const unitName = unit?.name || session.user.unitName || "Unit Kerja";
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        doc.on("data", (chunk: Buffer) =>
          controller.enqueue(new Uint8Array(chunk)),
        );
        doc.on("end", () => controller.close());
        doc.on("error", (error) => controller.error(error));
      },
      cancel() {
        doc.destroy();
      },
    });

    void renderPdf(doc, photos, programName, unitName)
      .then(() => doc.end())
      .catch((error) => doc.destroy(error as Error));

    const fileName = `Kolase_${sanitizeFilePart(programName)}_${sanitizeFilePart(unitName)}.pdf`;
    return new Response(stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/reports/export-collage");
  }
}
