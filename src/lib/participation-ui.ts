import type {
  ParticipationPreviewRow,
  ParticipationWorkbookActionStatus,
} from "@/types/participation.types";

export type ParticipationCorrectionPayload = {
  unitCode: string;
  overwrite: true;
  reason: string;
  expectedUpdatedAt: string;
};

export type ParticipationCommitPlan = {
  actionableCount: number;
  corrections: ParticipationCorrectionPayload[];
  error: string | null;
};

const PARTICIPATION_STATUS_LABELS: Record<
  ParticipationWorkbookActionStatus,
  string
> = {
  FIRST: "Data baru",
  UNCHANGED: "Sama (dilewati)",
  CORRECTION: "Koreksi",
  EMPTY: "Kosong (wajib dilengkapi)",
  ERROR: "Tidak valid",
};

export function getActionableParticipationRows(rows: ParticipationPreviewRow[]) {
  return rows.filter(
    (row) => row.sourceStatus === "FIRST" || row.sourceStatus === "CORRECTION",
  );
}

export function buildParticipationCommitPlan(
  rows: ParticipationPreviewRow[],
  correctionsConfirmed: boolean,
  reasons: Record<number, string>,
): ParticipationCommitPlan {
  if (rows.some((row) => row.sourceStatus === "ERROR")) {
    return {
      actionableCount: 0,
      corrections: [],
      error: "Perbaiki baris yang tidak valid sebelum menyimpan data",
    };
  }

  if (rows.some((row) => row.sourceStatus === "EMPTY")) {
    return {
      actionableCount: 0,
      corrections: [],
      error:
        "Lengkapi jumlah partisipasi pada semua baris kosong sebelum menyimpan data",
    };
  }

  const corrections: ParticipationCorrectionPayload[] = [];

  for (const row of rows) {
    if (row.sourceStatus !== "CORRECTION") continue;

    if (!correctionsConfirmed) {
      return {
        actionableCount: 0,
        corrections: [],
        error: "Konfirmasi seluruh koreksi sebelum menyimpan data",
      };
    }

    const reason = reasons[row.id]?.trim() ?? "";

    if (!reason) {
      return {
        actionableCount: 0,
        corrections: [],
        error: `Alasan koreksi wajib diisi untuk unit ${row.unitCode}`,
      };
    }

    if (!row.expectedUpdatedAt) {
      return {
        actionableCount: 0,
        corrections: [],
        error: `Versi data unit ${row.unitCode} tidak tersedia; lakukan preview ulang`,
      };
    }

    corrections.push({
      unitCode: row.unitCode,
      overwrite: true,
      reason,
      expectedUpdatedAt: row.expectedUpdatedAt,
    });
  }

  const actionableCount = rows.filter(
    (row) => row.sourceStatus === "FIRST" || row.sourceStatus === "CORRECTION",
  ).length;

  return actionableCount === 0
    ? {
        actionableCount,
        corrections,
        error: "Tidak ada data baru atau koreksi untuk disimpan",
      }
    : {
        actionableCount,
        corrections,
        error: null,
      };
}

export function getParticipationStatusLabel(
  status: ParticipationWorkbookActionStatus,
) {
  return PARTICIPATION_STATUS_LABELS[status];
}

export function getParticipationErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const response = (
      error as { response?: { data?: { message?: unknown } } }
    ).response;

    if (typeof response?.data?.message === "string") {
      return response.data.message;
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }
  }

  return "Gagal memproses file Excel";
}
