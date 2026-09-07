import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { parseParticipationPercentage } from "@/lib/participation-import";
import { prisma } from "@/lib/prisma";
import { canImportParticipation } from "@/lib/program-capabilities";
import { errorResponse, successResponse } from "@/lib/response";
import {
  commitParticipationSchema,
  participationFilterSchema,
  participationSnapshotCommitSchema,
} from "@/schemas/participation.schema";
import type {
  ParticipationPreviewRow,
  ParticipationStatus,
} from "@/types/participation.types";
import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { createParticipationSnapshots } from "@/lib/participation-snapshot";
import { decimalFromNumber, decimalToNumber } from "@/lib/decimal-contract";

async function getExcelParticipationCategory(categoryId: string) {
  const category = await prisma.programCategory.findUnique({
    where: { id: categoryId },
    select: { targetUnit: true, evidenceMode: true, scoreInputMode: true },
  });

  return category && canImportParticipation(category) ? category : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const action = new URL(req.url).searchParams.get("action");

    if (action === "snapshot-commit") {
      const parsed = participationSnapshotCommitSchema.safeParse(
        await req.json(),
      );

      if (!parsed.success) {
        return NextResponse.json(
          errorResponse(parsed.error.issues[0].message, 400),
          { status: 400 },
        );
      }

      const snapshots = await createParticipationSnapshots(parsed.data);

      return NextResponse.json(
        successResponse(
          {
            snapshots: snapshots.map((snapshot) => ({
              ...snapshot,
              percentage: snapshot.percentage.toNumber(),
            })),
          },
          "Snapshot partisipasi berhasil disimpan",
        ),
      );
    }

    if (action === "preview") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const parsed = participationFilterSchema.safeParse({
        categoryId: formData.get("categoryId"),
        tw: formData.get("tw"),
        year: formData.get("year"),
      });

      if (!parsed.success) {
        return NextResponse.json(
          errorResponse(parsed.error.issues[0].message, 400),
          { status: 400 },
        );
      }
      if (!file) {
        return NextResponse.json(
          errorResponse("File Excel wajib diunggah", 400),
          {
            status: 400,
          },
        );
      }

      const { categoryId, tw, year } = parsed.data;
      if (!(await getExcelParticipationCategory(categoryId))) {
        return NextResponse.json(
          errorResponse(
            "Kategori tidak tersedia untuk import Excel; gunakan kategori partisipasi dengan sumber Excel",
            422,
          ),
          { status: 422 },
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return NextResponse.json(
          errorResponse("Sheet Excel tidak ditemukan", 400),
          {
            status: 400,
          },
        );
      }

      const units = await prisma.unit.findMany({
        select: { id: true, name: true },
      });
      const unitMap = new Map(
        units.map((unit) => [unit.name.trim().toUpperCase(), unit]),
      );
      const existing = await prisma.participationData.findMany({
        where: { categoryId, tw, year },
        select: { unitId: true, percentage: true },
      });
      const existingMap = new Map(
        existing.map((row) => [row.unitId, decimalToNumber(row.percentage)]),
      );
      const rows: ParticipationPreviewRow[] = [];
      let id = 0;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 3) return;
        const unitName = String(
          row.getCell(2).text || row.getCell(2).value || "",
        ).trim();
        if (!unitName || unitName.toUpperCase() === "UNIT KERJA") return;

        const unit = unitMap.get(unitName.toUpperCase());
        if (!unit) {
          rows.push({
            id: id++,
            unitName,
            unitId: null,
            percentage: null,
            status: "error",
            errorMsg: "Unit tidak ditemukan di database",
          });
          return;
        }

        const parsedPercentage = parseParticipationPercentage(
          row.getCell(3).value,
        );
        if (!parsedPercentage.ok) {
          rows.push({
            id: id++,
            unitName: unit.name,
            unitId: unit.id,
            percentage: null,
            status: "error",
            errorMsg:
              parsedPercentage.reason === "empty"
                ? "Nilai persentase wajib diisi"
                : "Nilai persentase harus bilangan bulat 0 sampai 100",
          });
          return;
        }

        const oldPercentage = existingMap.get(unit.id);
        const status: ParticipationStatus =
          oldPercentage === undefined
            ? "matched"
            : oldPercentage === parsedPercentage.value
              ? "unchanged"
              : "conflict";
        rows.push({
          id: id++,
          unitName: unit.name,
          unitId: unit.id,
          percentage: parsedPercentage.value,
          status,
          existingPercentage: oldPercentage ?? null,
        });
      });

      const stats = {
        total: rows.length,
        matched: rows.filter((row) => row.status === "matched").length,
        conflict: rows.filter((row) => row.status === "conflict").length,
        unchanged: rows.filter((row) => row.status === "unchanged").length,
        error: rows.filter((row) => row.status === "error").length,
        empty: 0,
      };
      return NextResponse.json(
        successResponse({ stats, rows }, "Preview partisipasi berhasil"),
      );
    }

    if (action === "commit") {
      const parsed = commitParticipationSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json(
          errorResponse(parsed.error.issues[0].message, 400),
          { status: 400 },
        );
      }

      const { categoryId, tw, year, rows } = parsed.data;
      if (!(await getExcelParticipationCategory(categoryId))) {
        return NextResponse.json(
          errorResponse(
            "Kategori tidak tersedia untuk import Excel; gunakan kategori partisipasi dengan sumber Excel",
            422,
          ),
          { status: 422 },
        );
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const unit = await tx.unit.findUnique({
            where: { id: row.unitId },
            select: { id: true },
          });
          if (!unit)
            throw new ApiError("Unit tidak ditemukan di database", 400);

          const current = await tx.participationData.findUnique({
            where: {
              unitId_categoryId_tw_year: {
                unitId: unit.id,
                categoryId,
                tw,
                year,
              },
            },
            select: {
              importedById: true,
              evidenceReportId: true,
              assessedById: true,
              id: true,
              percentage: true,
            },
          });

          // Hanya row yang dibuat oleh Excel dan belum memiliki provenance lain yang kompatibel.
          const isCompatibleExcelRow =
            current !== null &&
            current.importedById !== null &&
            current.evidenceReportId === null &&
            current.assessedById === null;
          if (current && !isCompatibleExcelRow) {
            throw new ApiError(
              "Data dengan provenance yang tidak kompatibel tidak dapat ditimpa melalui Excel",
              409,
            );
          }

          if (!current) {
            await tx.participationData.create({
              data: {
                unitId: unit.id,
                categoryId,
                tw,
                year,
                percentage: decimalFromNumber(row.percentage),
                importedById: session.user.id,
              },
            });
            created++;
          } else if (
            decimalToNumber(current.percentage) === row.percentage
          ) {
            skipped++;
          } else if (row.overwrite) {
            await tx.participationData.update({
              where: { id: current.id },
              data: {
                percentage: decimalFromNumber(row.percentage),
                importedById: session.user.id,
                importedAt: new Date(),
              },
            });
            updated++;
          } else {
            skipped++;
          }
        }
      });

      return NextResponse.json(
        successResponse(
          { created, updated, skipped },
          "Import data partisipasi selesai",
        ),
      );
    }

    return NextResponse.json(
      errorResponse(
        "Action tidak valid. Gunakan ?action=preview atau ?action=commit",
        400,
      ),
      { status: 400 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/participation");
  }
}
