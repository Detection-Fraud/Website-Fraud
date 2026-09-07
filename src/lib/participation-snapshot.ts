import { Prisma } from "@generated/prisma/client";
import { ApiError } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";

export type ParticipationSnapshotCommitInput = {
  categoryId: string;
  tw: number;
  year: number;
  rows: Array<{
    unitId: string;
    participantCount: number;
  }>;
};

export type ParticipationSnapshotCommitResult = {
  id: string;
  unitId: string;
  categoryId: string;
  tw: number;
  year: number;
  headcount: number;
  participantCount: number;
  percentage: Prisma.Decimal;
  employeeSyncRunId: string;
  headcountCapturedAt: Date;
  unitNameSnapshot: string;
  parentUnitNameSnapshot: string | null;
  categoryNameSnapshot: string;
  warning: "ZERO_HEADCOUNT" | null;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function calculatePercentage(
  participantCount: number,
  headcount: number,
): Prisma.Decimal {
  if (headcount === 0) {
    return new Prisma.Decimal(0).toDecimalPlaces(2);
  }

  return new Prisma.Decimal(participantCount)
    .dividedBy(headcount)
    .times(100)
    .toDecimalPlaces(2);
}

export async function createParticipationSnapshots(
  input: ParticipationSnapshotCommitInput,
): Promise<ParticipationSnapshotCommitResult[]> {
  return prisma.$transaction(
    async (tx) => {
      const unitIds = input.rows.map((row) => row.unitId);

      const [category, latestSyncRun, units, existingRows] = await Promise.all([
        tx.programCategory.findUnique({
          where: { id: input.categoryId },
          select: {
            id: true,
            name: true,
          },
        }),
        tx.employeeSyncRun.findFirst({
          where: {
            status: "SUCCEEDED",
            completedAt: { not: null },
          },
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
          },
        }),
        tx.unit.findMany({
          where: {
            id: { in: unitIds },
          },
          select: {
            id: true,
            name: true,
            parent: {
              select: {
                name: true,
              },
            },
          },
        }),
        tx.participationData.findMany({
          where: {
            categoryId: input.categoryId,
            tw: input.tw,
            year: input.year,
            unitId: { in: unitIds },
          },
          select: {
            unitId: true,
          },
        }),
      ]);

      if (!category) {
        throw new ApiError("Kategori tidak ditemukan", 400);
      }

      if (!latestSyncRun) {
        throw new ApiError("Belum tersedia EmployeeSyncRun yang berhasil", 409);
      }

      if (units.length !== unitIds.length) {
        throw new ApiError("Unit tidak ditemukan di database", 400);
      }

      if (existingRows.length > 0) {
        throw new ApiError(
          "Snapshot partisipasi untuk periode ini sudah tersedia",
          409,
        );
      }

      const employeeCounts = await tx.employee.groupBy({
        by: ["unitId"],
        where: {
          unitId: { in: unitIds },
          isPresentInSource: true,
          kodeStatpeg: "01",
          statKepeg: "02",
        },
        _count: {
          _all: true,
        },
      });

      const headcountByUnitId = new Map(
        employeeCounts
          .filter(
            (row): row is typeof row & { unitId: string } =>
              row.unitId !== null,
          )
          .map((row) => [row.unitId, row._count._all]),
      );

      const unitById = new Map(units.map((unit) => [unit.id, unit]));
      const capturedAt = new Date();
      const results: ParticipationSnapshotCommitResult[] = [];

      for (const row of input.rows) {
        const headcount = headcountByUnitId.get(row.unitId) ?? 0;

        if (row.participantCount < 0) {
          throw new ApiError("Jumlah partisipasi tidak boleh negatif", 400);
        }

        if (row.participantCount > headcount) {
          throw new ApiError(
            "Jumlah partisipasi tidak boleh melebihi jumlah karyawan",
            400,
          );
        }

        const unit = unitById.get(row.unitId);
        if (!unit) {
          throw new ApiError("Unit tidak ditemukan di database", 400);
        }

        const percentage = calculatePercentage(row.participantCount, headcount);

        let created: { id: string };

        try {
          created = await tx.participationData.create({
            data: {
              unitId: row.unitId,
              categoryId: input.categoryId,
              tw: input.tw,
              year: input.year,
              headcount,
              participantCount: row.participantCount,
              percentage,
              provenance: "EMPLOYEE_SNAPSHOT",
              employeeSyncRunId: latestSyncRun.id,
              headcountCapturedAt: capturedAt,
              unitNameSnapshot: unit.name,
              parentUnitNameSnapshot: unit.parent?.name ?? null,
              categoryNameSnapshot: category.name,
            },
            select: {
              id: true,
            },
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw new ApiError(
              "Snapshot partisipasi dibuat oleh proses lain",
              409,
            );
          }

          throw error;
        }

        results.push({
          id: created.id,
          unitId: row.unitId,
          categoryId: input.categoryId,
          tw: input.tw,
          year: input.year,
          headcount,
          participantCount: row.participantCount,
          percentage,
          employeeSyncRunId: latestSyncRun.id,
          headcountCapturedAt: capturedAt,
          unitNameSnapshot: unit.name,
          parentUnitNameSnapshot: unit.parent?.name ?? null,
          categoryNameSnapshot: category.name,
          warning: headcount === 0 ? "ZERO_HEADCOUNT" : null,
        });
      }

      return results;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
