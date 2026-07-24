import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { getChildUnitIds } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import PDFDocument from "pdfkit";
import { z } from "zod";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

const LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "assets",
  "images",
  "logo-bulog-full.png",
);

// Schema Validasi Query Parameter
const querySchema = z
  .object({
    programId: z
      .string()
      .min(1, "Program wajib diisi")
      .refine((val) => val !== "ALL", "Program wajib dipilih"),
    scope: z.enum(["KANWIL_ONLY", "KANWIL_AND_KANCAB", "KANCAB", "DIVISI"]),
    kanwilId: z.string().optional(),
    kancabId: z.string().optional(),
    divisiId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.scope === "KANWIL_ONLY" || data.scope === "KANWIL_AND_KANCAB") &&
      (!data.kanwilId || data.kanwilId === "ALL")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "kanwilId wajib diisi untuk scope Kanwil",
        path: ["kanwilId"],
      });
    }
    if (
      data.scope === "KANCAB" &&
      (!data.kancabId || data.kancabId === "ALL")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "kancabId wajib diisi untuk scope Kancab",
        path: ["kancabId"],
      });
    }
    if (
      data.scope === "DIVISI" &&
      (!data.divisiId || data.divisiId === "ALL")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "divisiId wajib diisi untuk scope Divisi",
        path: ["divisiId"],
      });
    }
  });

export async function GET(req: NextRequest) {
  try {
    // 1. Auth Guard Admin
    await requireAdmin();

    // 2. Validasi Params
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = querySchema.safeParse(searchParams);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "Parameter tidak valid";
      return NextResponse.json(errorResponse(firstError, 400), { status: 400 });
    }

    const {
      programId,
      scope,
      kanwilId,
      kancabId,
      divisiId,
      startDate,
      endDate,
    } = parsed.data;

    // 3. Build Where Clause
    const where: any = {
      programId,
      status: "APPROVED",
      photos: { some: {} },
    };

    if (startDate && endDate) {
      where.tanggalKegiatan = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    switch (scope) {
      case "KANWIL_ONLY":
        where.unitId = kanwilId;
        break;
      case "KANWIL_AND_KANCAB": {
        const childIds = await getChildUnitIds(kanwilId!);
        where.unitId = { in: [kanwilId!, ...childIds] };
        break;
      }
      case "KANCAB":
        where.unitId = kancabId;
        break;
      case "DIVISI":
        where.unitId = divisiId;
        break;
    }

    // 4. Fetch Database
    const reports = await prisma.activityReport.findMany({
      where,
      include: {
        photos: { select: { imageUrl: true, originalName: true } },
        unit: { select: { name: true, parentId: true } },
        program: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { tanggalKegiatan: "desc" },
    });

    if (reports.length === 0) {
      // Cek alasan spesifik kenapa tidak ada report yang disetujui (APPROVED)
      const baseWhere = { ...where };
      delete baseWhere.status;

      const anyReports = await prisma.activityReport.findMany({
        where: baseWhere,
        select: { status: true },
      });

      if (anyReports.length === 0) {
        return NextResponse.json(
          errorResponse("Belum ada laporan yang dibuat untuk kriteria ini", 404),
          { status: 404 }
        );
      }

      const allRejected = anyReports.every((r) => r.status === "REJECTED");
      if (allRejected) {
        return NextResponse.json(
          errorResponse(
            "Gagal ekspor kolase: Semua laporan untuk kriteria ini ditolak (REJECTED)",
            404
          ),
          { status: 404 }
        );
      }

      const allPending = anyReports.every((r) => r.status === "PENDING");
      if (allPending) {
        return NextResponse.json(
          errorResponse(
            "Gagal ekspor kolase: Laporan masih dalam proses persetujuan (PENDING)",
            404
          ),
          { status: 404 }
        );
      }

      return NextResponse.json(
        errorResponse(
          "Tidak ada laporan yang disetujui (APPROVED) untuk kriteria ini",
          404
        ),
        { status: 404 }
      );
    }

    const allPhotos = reports.flatMap((r) =>
      r.photos.map((photo) => ({
        imageUrl: photo.imageUrl,
        activityName: r.activityName,
        date: new Date(r.tanggalKegiatan).toLocaleDateString("id-ID"),
        pic: r.createdBy?.name || "-",
        unitName: r.unit?.name || "-",
      })),
    );

    if (allPhotos.length === 0) {
      return NextResponse.json(
        errorResponse(
          "Tidak ada foto yang ditemukan untuk kriteria ini atau tidak ada laporan yang sudah di approved",
          404,
        ),
        { status: 404 },
      );
    }

    const programName = reports[0]?.program?.name || "Program Budaya";
    const unitName =
      scope === "KANWIL_ONLY" || scope === "KANWIL_AND_KANCAB"
        ? reports.find((r) => r.unitId === kanwilId)?.unit?.name ||
          "Kantor Wilayah"
        : scope === "KANCAB"
          ? reports.find((r) => r.unitId === kancabId)?.unit?.name ||
            "Kantor Cabang"
          : reports.find((r) => r.unitId === divisiId)?.unit?.name || "Divisi";

    // 5. Inisialisasi PDFKit dengan margin 0 (mencegah auto page break dari PDFKit)
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const cardWidth = 235;
    const cardHeight = 295;
    const photoAreaHeight = 215;
    const PHOTOS_PER_PAGE = 4;
    const totalPages = Math.ceil(allPhotos.length / PHOTOS_PER_PAGE);

    for (let i = 0; i < allPhotos.length; i++) {
      if (i > 0 && i % PHOTOS_PER_PAGE === 0) {
        doc.addPage();
      }

      const photo = allPhotos[i];
      const pageIndex = i % PHOTOS_PER_PAGE;
      const currentPage = Math.floor(i / PHOTOS_PER_PAGE) + 1;

      // Header Halaman (di render tiap kali awal halaman)
      if (pageIndex === 0) {
        // Logo Kanan Atas
        if (fs.existsSync(LOGO_PATH)) {
          doc.image(LOGO_PATH, 470, 25, { width: 85 });
        }

        // Judul & Subtitle Kiri Atas
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#1B4F88")
          .text("KOLASE FOTO KEGIATAN BUDAYA", 40, 25, { lineBreak: false });

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#475569")
          .text(`Program : ${programName}`, 40, 45, { lineBreak: false })
          .text(`Unit       : ${unitName}`, 40, 58, { lineBreak: false });

        // Garis Pembatas Header
        doc
          .strokeColor("#1B4F88")
          .lineWidth(1.5)
          .moveTo(40, 74)
          .lineTo(555, 74)
          .stroke();

        // Footer Halaman
        doc
          .strokeColor("#cbd5e1")
          .lineWidth(0.5)
          .moveTo(40, 805)
          .lineTo(555, 805)
          .stroke();

        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#94a3b8")
          .text("Dokumen Resmi System Fraud Detection BULOG", 40, 812, {
            lineBreak: false,
          });

        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor("#64748b")
          .text(`Halaman ${currentPage} dari ${totalPages}`, 400, 812, {
            width: 155,
            align: "right",
            lineBreak: false,
          });
      }

      // Hitung Grid 2x2
      const col = pageIndex % 2;
      const row = Math.floor(pageIndex / 2);
      const x = 40 + col * (cardWidth + 20);
      const y = 88 + row * (cardHeight + 20);

      // Card Container Outer Border
      doc
        .roundedRect(x, y, cardWidth, cardHeight, 6)
        .lineWidth(1)
        .strokeColor("#e2e8f0")
        .stroke();

      // Background Card Footer Watermark
      const footerY = y + photoAreaHeight;
      const footerHeight = cardHeight - photoAreaHeight;

      doc
        .rect(x + 1, footerY, cardWidth - 2, footerHeight - 1)
        .fillColor("#f8fafc")
        .fill();

      doc
        .moveTo(x, footerY)
        .lineTo(x + cardWidth, footerY)
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();

      // Baca Foto Lokal
      let imgBuffer: Buffer | null = null;
      try {
        const filename = photo.imageUrl.replace(/^\/uploads\//, "");
        const filePath = path.join(UPLOAD_DIR, filename);
        const resolvedFilePath = path.resolve(filePath);

        if (
          resolvedFilePath.startsWith(path.resolve(UPLOAD_DIR)) &&
          fs.existsSync(resolvedFilePath)
        ) {
          imgBuffer = fs.readFileSync(resolvedFilePath);
        }
      } catch (err) {
        console.error("Gagal membaca foto:", err);
      }

      // Render Gambar Presisi Centered
      if (imgBuffer) {
        try {
          doc.image(imgBuffer, x + 5, y + 5, {
            fit: [cardWidth - 10, photoAreaHeight - 10],
            align: "center",
          });
        } catch {
          doc
            .fontSize(8)
            .fillColor("#94a3b8")
            .text("Format foto tidak didukung", x, y + 100, {
              width: cardWidth,
              align: "center",
              lineBreak: false,
            });
        }
      } else {
        doc
          .fontSize(8)
          .fillColor("#94a3b8")
          .text("Foto tidak tersedia", x, y + 100, {
            width: cardWidth,
            align: "center",
            lineBreak: false,
          });
      }

      // Watermark Text Footer
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#1e293b")
        .text(photo.activityName, x + 8, footerY + 8, {
          width: cardWidth - 16,
          height: 20,
          ellipsis: true,
          lineBreak: false,
        });

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#64748b")
        .text(`${photo.date}   •   PIC: ${photo.pic}`, x + 8, footerY + 32, {
          width: cardWidth - 16,
          ellipsis: true,
          lineBreak: false,
        });
    }

    doc.end();

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const sanitizedProgram = programName.replace(/[^a-zA-Z0-9]/g, "_");
    const sanitizedUnit = unitName.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `Kolase_${sanitizedProgram}_${sanitizedUnit}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/reports/export-collage");
  }
}
