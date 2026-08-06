import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import {
  commitParticipationSchema,
  participationFilterSchema,
} from "@/schemas/participation.schema";
import {
  ParticipationPreviewRow,
  ParticipationStatus,
} from "@/types/participation.types";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // ACTION: PREVIEW
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

      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      const dataRows = rawRows.slice(3);

      const allUnits = await prisma.unit.findMany({
        select: { id: true, name: true },
      });

      const unitMap = new Map(
        allUnits.map((u) => [u.name.trim().toUpperCase(), u]),
      );
      const existingData = await prisma.participationData.findMany({
        where: { categoryId, tw, year },
        select: { unitId: true, percentage: true },
      });
      const existingMap = new Map(
        existingData.map((e) => [e.unitId, e.percentage]),
      );

      const previewRows: ParticipationPreviewRow[] = dataRows
        .map((row, index) => {
          const unitNameRaw = String(row[1] ?? "").trim();
          const percentageRaw = row[2];

          if (!unitNameRaw) return null;

          const matchedUnit = unitMap.get(unitNameRaw.toUpperCase());

          if (!matchedUnit) {
            return {
              id: index,
              unitName: unitNameRaw,
              unitId: null,
              percentage: null,
              status: "error" as ParticipationStatus,
              errorMsg: "Unit tidak ditemukan di database",
            };
          }

          if (
            percentageRaw === undefined ||
            percentageRaw === null ||
            String(percentageRaw).trim() === ""
          ) {
            return {
              id: index,
              unitName: matchedUnit.name,
              unitId: matchedUnit.id,
              percentage: null,
              status: "empty" as ParticipationStatus,
            };
          }

          const percentage = parseInt(String(percentageRaw), 10);
          if (isNaN(percentage) || percentage < 0) {
            return {
              id: index,
              unitName: matchedUnit.name,
              unitId: matchedUnit.id,
              percentage: null,
              status: "error" as ParticipationStatus,
              errorMsg: "Nilai persentase tidak valid (harus angka >= 0)",
            };
          }

          const existingPercentage = existingMap.get(matchedUnit.id);
          const hasExisting = existingPercentage !== undefined;

          let status: ParticipationStatus = "matched";
          if (hasExisting) {
            if (existingPercentage === percentage) {
              status = "unchanged";
            } else {
              status = "conflict";
            }
          }

          return {
            id: index,
            unitName: matchedUnit.name,
            unitId: matchedUnit.id,
            percentage,
            status,
            existingPercentage: existingPercentage ?? null,
          };
        })
        .filter(Boolean) as ParticipationPreviewRow[];

      const stats = {
        total: previewRows.length,
        matched: previewRows.filter((r) => r.status === "matched").length,
        conflict: previewRows.filter((r) => r.status === "conflict").length,
        unchanged: previewRows.filter((r) => r.status === "unchanged").length,
        error: previewRows.filter((r) => r.status === "error").length,
        empty: previewRows.filter((r) => r.status === "empty").length,
      };

      return NextResponse.json(
        successResponse(
          { stats, rows: previewRows },
          "Preview partisipasi berhasil",
        ),
      );
    }

    // ACTION: COMMIT
    if (action === "commit") {
      const body = await req.json();
      const parsed = commitParticipationSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          errorResponse(parsed.error.issues[0].message, 400),
          { status: 400 },
        );
      }

      const { categoryId, tw, year, rows } = parsed.data;

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          if (
            !row.unitId ||
            row.percentage === null ||
            row.percentage === undefined
          ) {
            skippedCount++;
            continue;
          }

          const existing = await tx.participationData.findUnique({
            where: {
              unitId_categoryId_tw_year: {
                unitId: row.unitId,
                categoryId,
                tw,
                year,
              },
            },
          });

          if (existing) {
            if (existing.percentage === row.percentage) {
              skippedCount++;
            } else if (row.overwrite) {
              await tx.participationData.update({
                where: { id: existing.id },
                data: {
                  percentage: row.percentage,
                  importedById: session.user.id,
                  importedAt: new Date(),
                },
              });
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            await tx.participationData.create({
              data: {
                unitId: row.unitId,
                categoryId,
                tw,
                year,
                percentage: row.percentage,
                importedById: session.user.id,
              },
            });
            createdCount++;
          }
        }
      });

      return NextResponse.json(
        successResponse(
          {
            created: createdCount,
            updated: updatedCount,
            skipped: skippedCount,
          },
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
