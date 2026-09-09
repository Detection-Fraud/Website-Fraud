import { ApiError } from "@/lib/api/auth-guard";
import { decimalFromNumber } from "@/lib/decimal-contract";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@generated/prisma/client";

export type ParticipationCorrectionRowInput = {
  unitId: string;
  participantCount: number;
  overwrite: boolean;
  reason?: string;
  expectedUpdatedAt?: string;
};

export type ParticipationCorrectionInput = {
  categoryId: string;
  tw: number;
  year: number;
  rows: ParticipationCorrectionRowInput[];
  actorId: string;
  actorName: string;
};

export type ParticipationCorrectionResult = {
  status: "UPDATED" | "UNCHANGED";
  participationDataId: string;
  unitId: string;
  participantCount: number;
  percentage: Prisma.Decimal;
  warning: "ZERO_HEADCOUNT" | null;
  auditId?: string;
};

export type CorrectionTransaction = Prisma.TransactionClient;

export type CorrectionDatabase = {
  $transaction: <T>(
    callback: (tx: CorrectionTransaction) => Promise<T>,
    options?: {
      isolationLevel: Prisma.TransactionIsolationLevel;
    },
  ) => Promise<T>;
};

type FrozenParticipationRow = {
  id: string;
  unitId: string;
  headcount: number | null;
  participantCount: number | null;
  percentage: Prisma.Decimal | null;
  provenance: string;
  employeeSyncRunId: string | null;
  headcountCapturedAt: Date | null;
  unitNameSnapshot: string | null;
  parentUnitNameSnapshot: string | null;
  categoryNameSnapshot: string | null;
  updatedAt: Date;
};

function calculatePercentage(
  participantCount: number,
  headcount: number,
): Prisma.Decimal {
  if (headcount === 0) {
    return decimalFromNumber(0).toDecimalPlaces(2);
  }

  return new Prisma.Decimal(participantCount)
    .dividedBy(headcount)
    .times(100)
    .toDecimalPlaces(2);
}

function isValidFrozenSnapshot(row: FrozenParticipationRow): boolean {
  if (
    row.provenance !== "EMPLOYEE_SNAPSHOT" ||
    row.headcount === null ||
    row.participantCount === null ||
    row.percentage === null ||
    row.employeeSyncRunId === null ||
    row.employeeSyncRunId.trim() === "" ||
    row.headcountCapturedAt === null ||
    row.unitNameSnapshot === null ||
    row.unitNameSnapshot.trim() === "" ||
    row.categoryNameSnapshot === null ||
    row.categoryNameSnapshot.trim() === ""
  ) {
    return false;
  }

  if (
    !Number.isInteger(row.headcount) ||
    row.headcount < 0 ||
    !Number.isInteger(row.participantCount) ||
    row.participantCount < 0 ||
    row.participantCount > row.headcount
  ) {
    return false;
  }

  return row.percentage.eq(
    calculatePercentage(row.participantCount, row.headcount),
  );
}

function getReason(row: ParticipationCorrectionRowInput): string {
  const reason = row.reason?.trim();

  if (!reason) {
    throw new ApiError(
      "Alasan koreksi wajib diisi untuk perubahan data partisipasi",
      400,
    );
  }

  if (reason.length > 500) {
    throw new ApiError("Alasan koreksi maksimal 500 karakter", 400);
  }

  return reason;
}

function parseExpectedUpdatedAt(value: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError("Versi data tidak valid", 400);
  }

  return parsed;
}

export async function correctParticipationSnapshotsInTransaction(
  input: ParticipationCorrectionInput,
  tx: CorrectionTransaction,
): Promise<ParticipationCorrectionResult[]> {
  if (input.rows.length === 0) {
    throw new ApiError("Data koreksi tidak boleh kosong", 400);
  }

  if (!input.actorId || !input.actorName) {
    throw new ApiError("Identitas actor tidak valid", 401);
  }

  for (const row of input.rows) {
    if (!Number.isInteger(row.participantCount) || row.participantCount < 0) {
      throw new ApiError(
        "Jumlah partisipasi harus berupa bilangan bulat non-negatif",
        400,
      );
    }
  }

  const orderedRows = [...input.rows].sort((a, b) =>
    a.unitId.localeCompare(b.unitId),
  );

  for (const row of orderedRows) {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${`participation-correction:${row.unitId}:${input.categoryId}:${input.tw}:${input.year}`})
      )::text
    `;
  }

  const currentRows = (await tx.participationData.findMany({
    where: {
      categoryId: input.categoryId,
      tw: input.tw,
      year: input.year,
      unitId: { in: orderedRows.map((row) => row.unitId) },
    },
    select: {
      id: true,
      unitId: true,
      headcount: true,
      participantCount: true,
      percentage: true,
      provenance: true,
      employeeSyncRunId: true,
      headcountCapturedAt: true,
      unitNameSnapshot: true,
      parentUnitNameSnapshot: true,
      categoryNameSnapshot: true,
      updatedAt: true,
    },
  })) as FrozenParticipationRow[];

  const currentByUnitId = new Map(
    currentRows.map((row) => [row.unitId, row]),
  );

  for (const inputRow of input.rows) {
    const current = currentByUnitId.get(inputRow.unitId);

    if (!current) {
      throw new ApiError(
        "Snapshot partisipasi untuk unit dan periode tersebut tidak ditemukan",
        409,
      );
    }

    if (!isValidFrozenSnapshot(current)) {
      throw new ApiError(
        "Snapshot partisipasi tidak memiliki denominator atau provenance yang valid",
        409,
      );
    }

    if (inputRow.participantCount > current.headcount!) {
      throw new ApiError(
        "Jumlah partisipasi tidak boleh melebihi jumlah karyawan pada snapshot",
        400,
      );
    }
  }

  const results: ParticipationCorrectionResult[] = [];

  for (const inputRow of input.rows) {
    const current = currentByUnitId.get(inputRow.unitId)!;
    const warning = current.headcount === 0 ? "ZERO_HEADCOUNT" : null;
    const percentage = calculatePercentage(
      inputRow.participantCount,
      current.headcount!,
    );

    if (inputRow.participantCount === current.participantCount) {
      results.push({
        status: "UNCHANGED",
        participationDataId: current.id,
        unitId: current.unitId,
        participantCount: current.participantCount!,
        percentage: current.percentage!,
        warning,
      });
      continue;
    }

    if (!inputRow.overwrite) {
      throw new ApiError("Koreksi membutuhkan konfirmasi overwrite", 409);
    }

    const reason = getReason(inputRow);

    if (!inputRow.expectedUpdatedAt) {
      throw new ApiError(
        "Versi data wajib dikirim saat mengubah snapshot partisipasi",
        400,
      );
    }
    const expectedUpdatedAt = parseExpectedUpdatedAt(
      inputRow.expectedUpdatedAt,
    );

    const audit = await tx.participationCorrectionAudit.create({
      data: {
        participationDataId: current.id,
        previousParticipantCount: current.participantCount,
        newParticipantCount: inputRow.participantCount,
        previousPercentage: current.percentage,
        newPercentage: percentage,
        reason,
        actorId: input.actorId,
        actorName: input.actorName,
      },
      select: { id: true },
    });

    const updateResult = await tx.participationData.updateMany({
      where: {
        id: current.id,
        updatedAt: expectedUpdatedAt,
      },
      data: {
        participantCount: inputRow.participantCount,
        percentage,
      },
    });

    if (updateResult.count !== 1) {
      throw new ApiError(
        "Snapshot partisipasi telah berubah. Silakan muat ulang data sebelum melakukan koreksi",
        409,
      );
    }

    results.push({
      status: "UPDATED",
      participationDataId: current.id,
      unitId: current.unitId,
      participantCount: inputRow.participantCount,
      percentage,
      warning,
      auditId: audit.id,
    });
  }

  return results;
}

export async function correctParticipationSnapshots(
  input: ParticipationCorrectionInput,
  database: CorrectionDatabase = prisma,
): Promise<ParticipationCorrectionResult[]> {
  return database.$transaction(
    (tx) => correctParticipationSnapshotsInTransaction(input, tx),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
