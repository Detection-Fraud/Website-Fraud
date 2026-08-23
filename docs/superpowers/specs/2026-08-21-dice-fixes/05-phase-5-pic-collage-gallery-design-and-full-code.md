# Phase 5: Galeri Kolase Foto PIC

Status: desain disetujui, siap dipindahkan ke source code setelah review dokumen.

Dokumen ini berisi desain final dan reference implementation lengkap. Tidak ada source code aplikasi yang diubah saat dokumen ini dibuat.

## 1. Tujuan

Menambahkan halaman baru `/pic/kolase` untuk melihat dan mengunduh kolase foto kegiatan budaya milik unit PIC yang sedang login.

Aturan bisnis final:

- Hanya role `PIC` yang dapat memakai halaman dan API galeri.
- Data selalu dibatasi ke `session.user.unitId` secara persis.
- PIC Kantor Wilayah tidak menerima foto Kantor Cabang anak pada fitur ini.
- Hanya foto dari laporan berstatus `APPROVED` yang ditampilkan.
- Kategori dipilih lebih dahulu, lalu Program Budaya.
- Program Budaya sudah mewakili TW, tahun, `startDate`, dan `endDate`. Tidak ada filter TW tambahan.
- Dropdown hanya memuat program yang mempunyai minimal satu foto approved untuk unit PIC tersebut.
- Galeri memakai numbered pagination dengan 12 foto per halaman.
- PDF memuat seluruh foto approved dari program terpilih dan unit PIC tersebut.
- Source aplikasi tidak membutuhkan dependency baru atau migration Prisma.

## 2. Design read

Halaman ini dibaca sebagai galeri internal BUMN untuk pengguna operasional. Bahasa visualnya profesional, aksesibel, content-first, dan mengikuti HeroUI v3 serta corporate blue yang sudah ada.

Design dials:

- Design variance: 4/10
- Motion intensity: 2/10
- Visual density: 5/10
- Theme: mengikuti theme global aplikasi
- Radius: konsisten `rounded-2xl` untuk surface utama dan `rounded-xl` untuk kontrol

## 3. Arsitektur

```text
Sidebar PIC
  -> /pic/kolase
     -> PicCollageView
        -> GET /api/reports/collage/options
        -> GET /api/reports/collage?programId=...&page=...&limit=12
        -> GET /api/reports/export-collage?programId=...

API gallery dan PDF
  -> getExactPicUnitId(session.user)
  -> buildPicCollagePhotoWhere(unitId, programId)
  -> ActivityPhoto -> ActivityReport
```

Keputusan penting: pagination dilakukan pada `ActivityPhoto`, bukan `ActivityReport`. Dengan demikian, satu laporan yang mempunyai banyak foto tidak dapat melewati batas 12 gambar per halaman.

## 4. Kontrak API

### `GET /api/reports/collage/options`

Tidak menerima filter unit dari browser.

```json
{
  "unit": { "id": "unit-id", "name": "Nama Unit" },
  "categories": [{ "id": "category-id", "name": "DONITA" }],
  "programs": [
    {
      "id": "program-id",
      "name": "DONITA TW 1",
      "tw": 1,
      "startDate": "2026-01-01T00:00:00.000Z",
      "endDate": "2026-03-31T00:00:00.000Z",
      "category": { "id": "category-id", "name": "DONITA" }
    }
  ]
}
```

### `GET /api/reports/collage`

Query:

```text
programId=<uuid>&page=1&limit=12
```

Response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 0,
    "totalPages": 0
  }
}
```

### Status error

- `400`: query tidak valid atau browser mengirim parameter yang tidak dikenal.
- `401`: belum login.
- `403`: bukan PIC atau PIC tidak memiliki `unitId`.
- `404`: export tidak memiliki foto approved.
- `500`: database atau PDF gagal.
- Galeri tanpa foto tetap mengembalikan `200` dengan `items: []`.

## 5. Performa

- Gallery query memakai `skip`, `take`, `count`, dan `select` terbatas.
- Maksimum 12 record foto dan 12 komponen gambar dirender per halaman.
- `next/image` menyediakan lazy loading dan reservasi rasio gambar.
- Query key menyertakan `programId` dan `page`.
- Filter berubah melalui URL tanpa effect fetch manual.
- PDF mengambil metadata sekali, lalu membaca buffer gambar per batch berisi 4 foto.
- PDFKit dialirkan langsung ke response. Hasil PDF tidak dikumpulkan menjadi satu `Buffer` besar.
- Index yang sudah ada cukup untuk versi awal: report `unitId`, `programId`, `status`, `tanggalKegiatan`, serta photo `reportId`.

## 6. Reference implementation

### 6.1 `src/types/collage.types.ts`

```ts
export interface CollageCategoryOption {
  id: string;
  name: string;
}

export interface CollageProgramOption {
  id: string;
  name: string;
  tw: number | null;
  startDate: string;
  endDate: string;
  category: CollageCategoryOption;
}

export interface CollageOptionsPayload {
  unit: { id: string; name: string };
  categories: CollageCategoryOption[];
  programs: CollageProgramOption[];
}

export interface CollagePhotoItem {
  id: number;
  imageUrl: string;
  originalName: string;
  report: {
    id: string;
    activityName: string;
    tanggalKegiatan: string;
    lokasi: string;
    picName: string;
  };
}

export interface CollageGalleryPayload {
  items: CollagePhotoItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### 6.2 `src/lib/api/collage.ts`

```ts
import { Prisma } from "@generated/prisma";
import { z } from "zod";
import { ApiError } from "./auth-guard";
import { getChildUnitIds } from "./unit-scope";

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const collageGalleryQuerySchema = z
  .object({
    programId: z.string().uuid("Program tidak valid"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(12).default(12),
  })
  .strict();

export const picCollageExportQuerySchema = z
  .object({ programId: z.string().uuid("Program tidak valid") })
  .strict();

export const adminCollageExportQuerySchema = z
  .object({
    programId: z.string().optional(),
    categoryId: z.string().optional(),
    scope: z.enum(["KANWIL_ONLY", "KANWIL_AND_KANCAB", "KANCAB", "DIVISI"]),
    kanwilId: z.string().optional(),
    kancabId: z.string().optional(),
    divisiId: z.string().optional(),
    startDate: dateParam.optional(),
    endDate: dateParam.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasProgram = data.programId && data.programId !== "ALL";
    const hasCategory = data.categoryId && data.categoryId !== "ALL";

    if (!hasProgram && !hasCategory) {
      ctx.addIssue({
        code: "custom",
        path: ["programId"],
        message: "Pilih minimal salah satu Program atau Kategori",
      });
    }

    if ((data.startDate && !data.endDate) || (!data.startDate && data.endDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Tanggal mulai dan selesai harus diisi bersamaan",
      });
    }

    if (
      ["KANWIL_ONLY", "KANWIL_AND_KANCAB"].includes(data.scope) &&
      (!data.kanwilId || data.kanwilId === "ALL")
    ) {
      ctx.addIssue({ code: "custom", path: ["kanwilId"], message: "Kanwil wajib dipilih" });
    }

    if (data.scope === "KANCAB" && (!data.kancabId || data.kancabId === "ALL")) {
      ctx.addIssue({ code: "custom", path: ["kancabId"], message: "Kancab wajib dipilih" });
    }

    if (data.scope === "DIVISI" && (!data.divisiId || data.divisiId === "ALL")) {
      ctx.addIssue({ code: "custom", path: ["divisiId"], message: "Divisi wajib dipilih" });
    }
  });

export function getExactPicUnitId(user: { role: string; unitId: string | null }) {
  if (user.role !== "PIC") throw new ApiError("Hanya PIC yang dapat mengakses", 403);
  if (!user.unitId) throw new ApiError("Unit kerja PIC tidak ditemukan", 403);
  return user.unitId;
}

export function buildPicCollagePhotoWhere(
  unitId: string,
  programId: string,
): Prisma.ActivityPhotoWhereInput {
  return {
    report: {
      is: { unitId, programId, status: "APPROVED" },
    },
  };
}

export async function buildAdminCollagePhotoWhere(
  input: z.infer<typeof adminCollageExportQuerySchema>,
) {
  const report: Prisma.ActivityReportWhereInput = { status: "APPROVED" };

  if (input.programId && input.programId !== "ALL") {
    report.programId = input.programId;
  } else if (input.categoryId && input.categoryId !== "ALL") {
    report.program = { categoryId: input.categoryId };
  }

  if (input.startDate && input.endDate) {
    const start = new Date(`${input.startDate}T00:00:00.000`);
    const end = new Date(`${input.endDate}T23:59:59.999`);
    report.tanggalKegiatan = { gte: start, lte: end };
  }

  let labelUnitId: string;
  if (input.scope === "KANWIL_AND_KANCAB") {
    const childIds = await getChildUnitIds(input.kanwilId!);
    report.unitId = { in: [input.kanwilId!, ...childIds] };
    labelUnitId = input.kanwilId!;
  } else if (input.scope === "KANWIL_ONLY") {
    report.unitId = input.kanwilId;
    labelUnitId = input.kanwilId!;
  } else if (input.scope === "KANCAB") {
    report.unitId = input.kancabId;
    labelUnitId = input.kancabId!;
  } else {
    report.unitId = input.divisiId;
    labelUnitId = input.divisiId!;
  }

  return {
    where: { report: { is: report } } satisfies Prisma.ActivityPhotoWhereInput,
    labelUnitId,
  };
}
```

### 6.3 `src/app/api/reports/collage/options/route.ts`

```ts
import { getExactPicUnitId } from "@/lib/api/collage";
import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await requireAuth();
    const unitId = getExactPicUnitId(session.user);

    const programs = await prisma.programBudaya.findMany({
      where: {
        category: { is: { targetUnit: "KEGIATAN" } },
        activityReports: {
          some: { unitId, status: "APPROVED", photos: { some: {} } },
        },
      },
      select: {
        id: true,
        name: true,
        tw: true,
        startDate: true,
        endDate: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
    });

    const categories = Array.from(
      new Map(
        programs
          .filter((program) => program.category)
          .map((program) => [program.category!.id, program.category!]),
      ).values(),
    ).sort((a, b) => a.name.localeCompare(b.name, "id"));

    return NextResponse.json(
      successResponse({
        unit: { id: unitId, name: session.user.unitName || "Unit Kerja" },
        categories,
        programs: programs.filter((program) => program.category),
      }),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/collage/options");
  }
}
```

### 6.4 `src/app/api/reports/collage/route.ts`

```ts
import {
  buildPicCollagePhotoWhere,
  collageGalleryQuerySchema,
  getExactPicUnitId,
} from "@/lib/api/collage";
import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
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
        errorResponse(parsed.error.issues[0]?.message || "Parameter tidak valid", 400),
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
```

### 6.5 Full replacement `src/app/api/reports/export-collage/route.ts`

Route ini mempertahankan kontrak filter Admin yang sekarang dan menambahkan mode PIC berdasarkan role session.

```ts
import {
  adminCollageExportQuerySchema,
  buildAdminCollagePhotoWhere,
  buildPicCollagePhotoWhere,
  getExactPicUnitId,
  picCollageExportQuerySchema,
} from "@/lib/api/collage";
import { ApiError, handleApiError, requireAuth } from "@/lib/api/auth-guard";
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
  doc.strokeColor("#1B4F88").lineWidth(1.5).moveTo(40, 74).lineTo(555, 74).stroke();
  doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(40, 805).lineTo(555, 805).stroke();
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

  doc.roundedRect(x, y, cardWidth, cardHeight, 6).lineWidth(1).strokeColor("#e2e8f0").stroke();
  doc.rect(x + 1, footerY, cardWidth - 2, cardHeight - photoHeight - 1).fillColor("#f8fafc").fill();
  doc.moveTo(x, footerY).lineTo(x + cardWidth, footerY).strokeColor("#e2e8f0").stroke();

  if (image) {
    try {
      doc.image(image, x + 5, y + 5, {
        fit: [cardWidth - 10, photoHeight - 10],
        align: "center",
        valign: "center",
      });
    } catch {
      doc.fontSize(8).fillColor("#94a3b8").text("Format foto tidak didukung", x, y + 100, {
        width: cardWidth,
        align: "center",
      });
    }
  } else {
    doc.fontSize(8).fillColor("#94a3b8").text("Foto tidak tersedia", x, y + 100, {
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
    .text(`${date} | PIC: ${photo.report.createdBy?.name || "-"}`, x + 8, footerY + 34, {
      width: cardWidth - 16,
      ellipsis: true,
    });
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
    const buffers = await Promise.all(pagePhotos.map((photo) => readPhoto(photo.imageUrl)));

    drawPageFrame(
      doc,
      programName,
      unitName,
      Math.floor(offset / photosPerPage) + 1,
      totalPages,
    );
    pagePhotos.forEach((photo, index) => drawPhotoCard(doc, photo, buffers[index], index));
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
          errorResponse(parsed.error.issues[0]?.message || "Parameter tidak valid", 400),
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
          errorResponse(parsed.error.issues[0]?.message || "Parameter tidak valid", 400),
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
      return NextResponse.json(errorResponse("Belum ada foto approved untuk kriteria ini", 404), {
        status: 404,
      });
    }

    const [unit, category] = await Promise.all([
      prisma.unit.findUnique({ where: { id: labelUnitId }, select: { name: true } }),
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
        doc.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
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
```

### 6.6 `src/hooks/usePicCollage.ts`

```ts
"use client";

import { api } from "@/lib/api";
import type { CollageGalleryPayload, CollageOptionsPayload } from "@/types/collage.types";
import { useMutation, useQuery } from "@tanstack/react-query";

export function usePicCollageOptions() {
  return useQuery<CollageOptionsPayload>({
    queryKey: ["pic-collage-options"],
    queryFn: () => api.get("/reports/collage/options").then((response) => response.data),
    staleTime: 30_000,
  });
}

export function usePicCollageGallery(programId: string, page: number) {
  return useQuery<CollageGalleryPayload>({
    queryKey: ["pic-collage", { programId, page, limit: 12 }],
    queryFn: () =>
      api
        .get("/reports/collage", { params: { programId, page, limit: 12 } })
        .then((response) => response.data),
    enabled: Boolean(programId),
    staleTime: 30_000,
  });
}

export function useDownloadPicCollage() {
  return useMutation<Blob, Error, string>({
    mutationFn: (programId) =>
      api
        .get("/reports/export-collage", {
          params: { programId },
          responseType: "blob",
        })
        .then((response) => response.data),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "kolase-foto.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
}
```

### 6.7 Pindahkan pagination menjadi reusable

Pindahkan `src/app/(main)/admin/approval/_components/PaginationFooter.tsx` menjadi `src/components/ui/PaginationFooter.tsx`, lalu gunakan full code berikut.

```tsx
import { Card, Pagination } from "@heroui/react";

interface PaginationFooterProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}

export default function PaginationFooter({
  page,
  totalPages,
  totalItems,
  itemsPerPage,
  itemLabel = "data",
  onPageChange,
}: PaginationFooterProps) {
  if (totalPages <= 1) return null;

  const startItem = (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalItems);
  const pages: (number | "ellipsis")[] = [];

  if (totalPages <= 7) {
    for (let value = 1; value <= totalPages; value++) pages.push(value);
  } else {
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    for (
      let value = Math.max(2, page - 1);
      value <= Math.min(totalPages - 1, page + 1);
      value++
    ) {
      pages.push(value);
    }
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <Pagination className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
        <Pagination.Summary className="text-center text-xs text-slate-500 sm:text-left sm:text-sm">
          Menampilkan <span className="font-semibold text-slate-700">{startItem}-{endItem}</span> dari{" "}
          <span className="font-semibold text-slate-700">{totalItems}</span> {itemLabel}
        </Pagination.Summary>
        <Pagination.Content className="flex items-center gap-1 overflow-x-auto">
          <Pagination.Item>
            <Pagination.Previous isDisabled={page === 1} onPress={() => onPageChange(page - 1)}>
              <Pagination.PreviousIcon />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Pagination.Previous>
          </Pagination.Item>
          {pages.map((value, index) =>
            value === "ellipsis" ? (
              <Pagination.Item key={`ellipsis-${index}`}>
                <Pagination.Ellipsis />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={value}>
                <Pagination.Link
                  isActive={value === page}
                  onPress={() => onPageChange(value)}
                  className={value === page ? "bg-blue-600 font-semibold text-white" : ""}
                >
                  {value}
                </Pagination.Link>
              </Pagination.Item>
            ),
          )}
          <Pagination.Item>
            <Pagination.Next
              isDisabled={page === totalPages}
              onPress={() => onPageChange(page + 1)}
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </Card>
  );
}
```

Ubah import pada `ApprovalView.tsx`:

```ts
import PaginationFooter from "@/components/ui/PaginationFooter";
```

### 6.8 `src/app/(main)/pic/kolase/_components/PicCollageView.tsx`

```tsx
"use client";

import AppBar from "@/components/layout/Appbar";
import PaginationFooter from "@/components/ui/PaginationFooter";
import SafeImage from "@/components/ui/SafeImage";
import {
  useDownloadPicCollage,
  usePicCollageGallery,
  usePicCollageOptions,
} from "@/hooks/usePicCollage";
import type { CollagePhotoItem } from "@/types/collage.types";
import { Button, Card, Label, ListBox, Modal, Select, Skeleton, Spinner } from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiImage,
  FiMapPin,
} from "react-icons/fi";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Memuat foto">
      {Array.from({ length: 12 }, (_, index) => (
        <Card key={index} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-0">
          <Skeleton className="aspect-4/3 w-full rounded-none" />
          <Card.Content className="space-y-3 p-4">
            <Skeleton className="h-4 w-4/5 rounded-lg" />
            <Skeleton className="h-3 w-3/5 rounded-lg" />
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}

function PhotoLightbox({
  photos,
  index,
  onChange,
  onClose,
}: {
  photos: CollagePhotoItem[];
  index: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const photo = index === null ? null : photos[index];

  useEffect(() => {
    if (!photo || index === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && index > 0) onChange(index - 1);
      if (event.key === "ArrowRight" && index < photos.length - 1) onChange(index + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, onChange, photo, photos.length]);

  return (
    <Modal>
      <Modal.Backdrop variant="blur" isOpen={Boolean(photo)} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container size="cover">
          <Modal.Dialog className="overflow-hidden rounded-2xl bg-slate-950 p-0 text-white">
            <Modal.CloseTrigger className="z-20 bg-slate-900/80 text-white" />
            {photo && (
              <>
                <Modal.Body className="p-0">
                  <div className="relative aspect-video w-full bg-slate-950">
                    <SafeImage
                      fill
                      src={photo.imageUrl}
                      alt={`Foto ${photo.report.activityName}`}
                      sizes="(max-width: 1280px) 100vw, 1280px"
                      className="object-contain"
                      fallbackIconClassName="size-12 text-slate-500"
                    />
                    <Button
                      isIconOnly
                      aria-label="Foto sebelumnya"
                      variant="secondary"
                      isDisabled={index === 0}
                      onPress={() => onChange(index! - 1)}
                      className="absolute left-3 top-1/2 min-h-11 min-w-11 -translate-y-1/2"
                    >
                      <FiChevronLeft aria-hidden="true" />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label="Foto berikutnya"
                      variant="secondary"
                      isDisabled={index === photos.length - 1}
                      onPress={() => onChange(index! + 1)}
                      className="absolute right-3 top-1/2 min-h-11 min-w-11 -translate-y-1/2"
                    >
                      <FiChevronRight aria-hidden="true" />
                    </Button>
                  </div>
                </Modal.Body>
                <Modal.Footer className="flex-col items-start gap-1 border-t border-white/10 px-5 py-4">
                  <p className="font-semibold text-white">{photo.report.activityName}</p>
                  <p className="text-sm text-slate-300">
                    {dateFormatter.format(new Date(photo.report.tanggalKegiatan))} | {photo.report.lokasi}
                  </p>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default function PicCollageView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId") || "";
  const programId = searchParams.get("programId") || "";
  const page = parsePage(searchParams.get("page"));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const optionsQuery = usePicCollageOptions();
  const galleryQuery = usePicCollageGallery(programId, page);
  const downloadMutation = useDownloadPicCollage();
  const programs = useMemo(
    () => optionsQuery.data?.programs.filter((program) => program.category.id === categoryId) ?? [],
    [categoryId, optionsQuery.data?.programs],
  );
  const selectedProgram = optionsQuery.data?.programs.find((program) => program.id === programId);

  const replaceParams = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handlePageChange = (nextPage: number) => {
    replaceParams({ page: String(nextPage) });
    document.getElementById("collage-grid")?.scrollIntoView({ block: "start" });
  };

  const photos = galleryQuery.data?.items ?? [];
  const pagination = galleryQuery.data?.pagination;

  return (
    <div className="mb-10 space-y-6">
      <AppBar
        showAddButton={false}
        title="Kolase Foto"
        description="Foto kegiatan budaya yang sudah disetujui untuk unit kerja Anda"
      />

      <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <Card.Header>
          <Card.Title className="text-base font-semibold text-slate-900">Pilih program</Card.Title>
          <Card.Description className="text-sm text-slate-500">
            Program hanya tersedia jika unit Anda mempunyai foto approved.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <Select
            aria-label="Pilih kategori"
            placeholder="Pilih kategori"
            value={categoryId}
            isDisabled={optionsQuery.isLoading || optionsQuery.isError}
            onChange={(value) =>
              replaceParams({ categoryId: String(value || ""), programId: null, page: "1" })
            }
          >
            <Label>Kategori</Label>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(optionsQuery.data?.categories ?? []).map((category) => (
                  <ListBox.Item key={category.id} id={category.id} textValue={category.name}>
                    {category.name}<ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            aria-label="Pilih program budaya"
            placeholder={categoryId ? "Pilih program" : "Pilih kategori dahulu"}
            value={programId}
            isDisabled={!categoryId || programs.length === 0}
            onChange={(value) => replaceParams({ programId: String(value || ""), page: "1" })}
          >
            <Label>Program Budaya</Label>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                {programs.map((program) => (
                  <ListBox.Item key={program.id} id={program.id} textValue={program.name}>
                    {program.name}<ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Button
            variant="primary"
            isDisabled={!programId}
            isPending={downloadMutation.isPending}
            onPress={() => downloadMutation.mutate(programId)}
            className="min-h-11 whitespace-nowrap"
          >
            {({ isPending }) => (
              <>{isPending ? <Spinner color="current" size="sm" /> : <FiDownload />} {isPending ? "Menyiapkan PDF" : "Download PDF"}</>
            )}
          </Button>
        </Card.Content>
      </Card>

      {optionsQuery.isError && (
        <Card className="rounded-2xl border border-red-200 bg-red-50">
          <Card.Content className="flex items-center justify-between gap-4 text-red-800">
            <div className="flex items-center gap-3"><FiAlertCircle /><span>Gagal memuat pilihan program.</span></div>
            <Button variant="outline" onPress={() => optionsQuery.refetch()}>Coba lagi</Button>
          </Card.Content>
        </Card>
      )}

      {downloadMutation.isError && (
        <p role="alert" className="text-sm font-medium text-red-700">PDF gagal dibuat. Silakan coba lagi.</p>
      )}

      {selectedProgram && pagination && (
        <Card className="rounded-2xl border border-blue-100 bg-blue-50/70 shadow-none">
          <Card.Content className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-slate-500">Program</p><p className="font-semibold text-slate-900">{selectedProgram.name}</p></div>
            <div><p className="text-xs text-slate-500">Triwulan</p><p className="font-semibold text-slate-900">TW {selectedProgram.tw ?? "-"}</p></div>
            <div><p className="text-xs text-slate-500">Periode</p><p className="font-semibold text-slate-900">{dateFormatter.format(new Date(selectedProgram.startDate))} - {dateFormatter.format(new Date(selectedProgram.endDate))}</p></div>
            <div><p className="text-xs text-slate-500">Foto approved</p><p className="font-semibold text-slate-900">{pagination.total} foto</p></div>
          </Card.Content>
        </Card>
      )}

      {!programId && !optionsQuery.isError && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FiImage className="mx-auto mb-3 size-8 text-slate-400" />
          <p className="font-semibold text-slate-800">Pilih kategori dan program</p>
          <p className="mt-1 text-sm text-slate-500">Foto approved akan ditampilkan setelah program dipilih.</p>
        </div>
      )}

      {programId && galleryQuery.isLoading && <GallerySkeleton />}

      {programId && galleryQuery.isError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
          <FiAlertCircle className="mx-auto mb-3 size-8 text-red-500" />
          <p className="font-semibold text-red-900">Galeri gagal dimuat</p>
          <Button className="mt-4" variant="outline" onPress={() => galleryQuery.refetch()}>Coba lagi</Button>
        </div>
      )}

      {programId && galleryQuery.isSuccess && photos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FiImage className="mx-auto mb-3 size-8 text-slate-400" />
          <p className="font-semibold text-slate-800">Belum ada foto approved</p>
          <p className="mt-1 text-sm text-slate-500">Foto akan muncul setelah laporan disetujui Admin.</p>
        </div>
      )}

      {photos.length > 0 && (
        <>
          <div id="collage-grid" className="scroll-mt-24 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {photos.map((photo, index) => (
              <Card key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-0 shadow-sm">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="group relative aspect-4/3 w-full cursor-zoom-in overflow-hidden bg-slate-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  aria-label={`Buka foto ${photo.report.activityName}`}
                >
                  <SafeImage
                    fill
                    src={photo.imageUrl}
                    alt={`Kegiatan ${photo.report.activityName}`}
                    sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                    className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    fallbackIconClassName="size-9 text-slate-400"
                  />
                </button>
                <Card.Content className="space-y-2 p-4">
                  <p className="line-clamp-2 font-semibold text-slate-900">{photo.report.activityName}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{dateFormatter.format(new Date(photo.report.tanggalKegiatan))}</span>
                    <span className="inline-flex items-center gap-1"><FiMapPin />{photo.report.lokasi}</span>
                  </div>
                  <p className="text-xs text-slate-500">PIC: {photo.report.picName}</p>
                </Card.Content>
              </Card>
            ))}
          </div>

          {pagination && (
            <PaginationFooter
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              itemLabel="foto"
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </div>
  );
}
```

### 6.9 `src/app/(main)/pic/kolase/page.tsx`

```tsx
import type { Metadata } from "next";
import PicCollageView from "./_components/PicCollageView";

export const metadata: Metadata = {
  title: "Kolase Foto PIC",
  description: "Galeri foto kegiatan budaya yang sudah disetujui untuk unit kerja PIC.",
};

export default function PicCollagePage() {
  return <PicCollageView />;
}
```

### 6.10 Tambahkan menu pada `src/constants/sidebar.constants.tsx`

`PiImage` sudah di-import, jadi tidak ada import baru.

```tsx
{
  key: "kolase",
  label: "Kolase Foto",
  href: "/pic/kolase",
  icon: <PiImage />,
},
```

Letakkan setelah menu `Laporan` dan sebelum `Kalendar`.

### 6.11 Minimal runnable check `scripts/check-pic-collage-contract.ts`

```ts
import assert from "node:assert/strict";
import {
  buildPicCollagePhotoWhere,
  collageGalleryQuerySchema,
  getExactPicUnitId,
} from "../src/lib/api/collage";

assert.equal(getExactPicUnitId({ role: "PIC", unitId: "unit-a" }), "unit-a");
assert.throws(() => getExactPicUnitId({ role: "ADMIN", unitId: "unit-a" }));
assert.throws(() => getExactPicUnitId({ role: "PIC", unitId: null }));

assert.deepEqual(buildPicCollagePhotoWhere("unit-a", "program-a"), {
  report: {
    is: { unitId: "unit-a", programId: "program-a", status: "APPROVED" },
  },
});

assert.equal(
  collageGalleryQuerySchema.safeParse({
    programId: "00000000-0000-4000-8000-000000000000",
    page: "1",
    limit: "12",
  }).success,
  true,
);

assert.equal(
  collageGalleryQuerySchema.safeParse({
    programId: "00000000-0000-4000-8000-000000000000",
    page: "1",
    limit: "100",
  }).success,
  false,
);

console.log("PIC collage contract check passed");
```

Jalankan:

```powershell
npx tsx scripts/check-pic-collage-contract.ts
```

## 7. Urutan penerapan

1. Tambahkan types dan shared backend helper.
2. Tambahkan options API dan gallery API.
3. Ganti export route dengan versi dual-role.
4. Pindahkan pagination reusable dan perbarui import Approval Admin.
5. Tambahkan hook, page, dan view Kolase PIC.
6. Tambahkan sidebar item.
7. Jalankan contract check, lint, dan build.

## 8. Acceptance criteria

- PIC membuka `/pic/kolase` dari sidebar.
- Program tanpa foto approved tidak muncul pada pilihan.
- PIC hanya dapat melihat foto unit persis miliknya.
- Browser tidak dapat memperluas scope dengan mengirim `unitId`.
- Galeri menampilkan maksimal 12 foto pada satu halaman.
- Pergantian kategori atau program mengembalikan page ke 1.
- URL menyimpan `categoryId`, `programId`, dan `page`.
- Lightbox dapat ditutup dengan Escape dan dinavigasi dengan keyboard.
- Tombol PDF mencegah double-submit dan memberikan loading feedback.
- PDF berisi seluruh foto approved dari satu unit dan satu program.
- Admin export lama tetap menerima parameter scope yang sama.
- Tidak ada dependency atau migration baru.

## 9. Hal yang sengaja tidak dibuat

- Infinite scroll dan load-more.
- Filter Triwulan terpisah.
- Child-unit scope untuk PIC Kanwil.
- Global state baru.
- Virtualization library.
- Queue atau background job PDF.
- Index database baru sebelum ada bukti bottleneck.

Queue/background job baru layak ditambahkan jika export nyata melewati timeout platform. Virtualization baru layak ditambahkan jika batas 12 foto per halaman berubah menjadi ratusan item.
