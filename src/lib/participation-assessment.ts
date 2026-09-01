import { ApiError } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@generated/prisma";

export type AssessmentInput = {
  reportId: string;
  actorId: string;
  actorName: string;
  percentage: number;
  changeReason?: string;
  expectedUpdatedAt?: string;
};

export type AssessmentResult = {
  status: "CREATED" | "UPDATED" | "UNCHANGED";
  participationDataId: string;
  percentage: number;
  historyId?: string;
};

export type AssessmentDatabase = {
  activityReport: Pick<typeof prisma.activityReport, "findUnique">;
  $transaction: <T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) => Promise<T>;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function assessParticipationScore(
  input: AssessmentInput,
  database: AssessmentDatabase = prisma,
): Promise<AssessmentResult> {
  const {
    reportId,
    actorId,
    actorName,
    percentage,
    changeReason,
    expectedUpdatedAt,
  } = input;

  if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
    throw new ApiError(
      "Nilai persentase harus bilangan bulat antara 0 dan 100",
      400,
    );
  }

  const report = await database.activityReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      unitId: true,
      status: true,
      program: {
        select: {
          tw: true,
          startDate: true,
          category: {
            select: {
              id: true,
              targetUnit: true,
              evidenceMode: true,
              scoreInputMode: true,
            },
          },
        },
      },
    },
  });

  if (
    !report ||
    !report.program ||
    !report.program.category ||
    !report.unitId
  ) {
    throw new ApiError("Data laporan atau relasi program tidak valid", 404);
  }

  if (report.status !== "APPROVED") {
    throw new ApiError(
      "Penilaian hanya dapat dilakukan pada laporan yang telah disetujui (APPROVED)",
      409,
    );
  }

  const category = report.program.category;
  if (category.scoreInputMode === "EXCEL_IMPORT") {
    throw new ApiError(
      "Kategori import Excel tidak mendukung penilaian langsung oleh admin",
      422,
    );
  }

  if (
    category.targetUnit !== "PARTISIPASI_PERSEN" ||
    category.evidenceMode !== "PHOTO_WITHOUT_AI" ||
    category.scoreInputMode !== "DIRECT_ADMIN"
  ) {
    throw new ApiError(
      "Kategori ini tidak mendukung penilaian langsung oleh admin",
      422,
    );
  }

  const tw = report.program.tw;
  if (tw === null || !Number.isInteger(tw) || tw < 1 || tw > 4) {
    throw new ApiError("Program laporan tidak memiliki TW valid (1-4)", 422);
  }

  const year = report.program.startDate.getUTCFullYear();
  const unitId = report.unitId;
  const categoryId = category.id;

  return database.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${`direct-score:${unitId}:${categoryId}:${tw}:${year}`})
      )::text
    `;

    const existing = await tx.participationData.findUnique({
      where: { unitId_categoryId_tw_year: { unitId, categoryId, tw, year } },
      select: {
        id: true,
        percentage: true,
        updatedAt: true,
        evidenceReportId: true,
        importedById: true,
      },
    });

    if (existing) {
      const isExcelOrigin = existing.importedById !== null;
      const isUnknownOrigin =
        existing.importedById === null && existing.evidenceReportId === null;
      const isDifferentReport =
        existing.importedById === null &&
        existing.evidenceReportId !== null &&
        existing.evidenceReportId !== report.id;

      if (isExcelOrigin || isUnknownOrigin || isDifferentReport) {
        throw new ApiError(
          "Data partisipasi pada identitas kanonik telah memiliki sumber yang berbeda",
          409,
        );
      }
    }

    if (existing && existing.percentage === percentage) {
      return {
        status: "UNCHANGED",
        participationDataId: existing.id,
        percentage: existing.percentage,
      };
    }

    if (!existing) {
      let saved: { id: string };
      try {
        saved = await tx.participationData.create({
          data: {
            unitId,
            categoryId,
            tw,
            year,
            percentage,
            evidenceReportId: report.id,
            assessedById: actorId,
            assessedAt: new Date(),
          },
          select: { id: true },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ApiError(
            "Data nilai telah dibuat oleh pengguna lain. Silakan muat ulang halaman",
            409,
          );
        }
        throw error;
      }

      const history = await tx.participationScoreHistory.create({
        data: {
          participationDataId: saved.id,
          evidenceReportId: report.id,
          categoryId,
          action: "CREATED",
          previousPercentage: null,
          newPercentage: percentage,
          actorId,
          actorName,
        },
        select: { id: true },
      });

      return {
        status: "CREATED",
        participationDataId: saved.id,
        percentage,
        historyId: history.id,
      };
    }

    const reason = changeReason?.trim();
    if (!reason || reason.length < 10 || reason.length > 500) {
      throw new ApiError(
        "Alasan perubahan nilai wajib diisi antara 10 hingga 500 karakter",
        400,
      );
    }

    if (!expectedUpdatedAt) {
      throw new ApiError("Versi data wajib dikirim saat mengubah nilai", 400);
    }

    const expectedVersion = new Date(expectedUpdatedAt);
    if (Number.isNaN(expectedVersion.getTime())) {
      throw new ApiError("Versi data tidak valid", 400);
    }

    const updateResult = await tx.participationData.updateMany({
      where: {
        id: existing.id,
        updatedAt: expectedVersion,
      },
      data: {
        percentage,
        assessedById: actorId,
        assessedAt: new Date(),
      },
    });

    if (updateResult.count !== 1) {
      throw new ApiError(
        "Data nilai telah diperbarui oleh pengguna lain (konflik versi). Silakan muat ulang halaman",
        409,
      );
    }

    const history = await tx.participationScoreHistory.create({
      data: {
        participationDataId: existing.id,
        evidenceReportId: report.id,
        categoryId,
        action: "UPDATED",
        previousPercentage: existing.percentage,
        newPercentage: percentage,
        changeReason: reason,
        actorId,
        actorName,
      },
      select: { id: true },
    });

    return {
      status: "UPDATED",
      participationDataId: existing.id,
      percentage,
      historyId: history.id,
    };
  });
}
