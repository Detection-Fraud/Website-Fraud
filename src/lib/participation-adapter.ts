import type {
  ParticipationImportStats,
  ParticipationPreviewRow,
  ParticipationStatus,
  ParticipationWorkbookActionStatus,
  ParticipationWorkbookPreview,
} from "@/types/participation.types";

function toLegacyStatus(
  status: ParticipationWorkbookActionStatus,
): ParticipationStatus {
  switch (status) {
    case "FIRST":
      return "matched";
    case "CORRECTION":
      return "conflict";
    case "UNCHANGED":
      return "unchanged";
    case "EMPTY":
      return "empty";
    case "ERROR":
      return "error";
  }
}

export function toLegacyParticipationPreviewRow(
  row: ParticipationWorkbookPreview["rows"][number],
): ParticipationPreviewRow {
  return {
    ...row,
    sourceStatus: row.status,
    status: toLegacyStatus(row.status),
  };
}

export function toLegacyParticipationPreview(
  preview: ParticipationWorkbookPreview,
): {
  rows: ParticipationPreviewRow[];
  stats: ParticipationImportStats;
} {
  return {
    rows: preview.rows.map(toLegacyParticipationPreviewRow),
    stats: {
      ...preview.stats,
      matched: preview.stats.first,
      conflict: preview.stats.correction,
    },
  };
}
