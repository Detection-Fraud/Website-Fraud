export type ParticipationWorkbookActionStatus =
  | "FIRST"
  | "UNCHANGED"
  | "CORRECTION"
  | "EMPTY"
  | "ERROR";

export type ParticipationStatus =
  | "matched"
  | "conflict"
  | "unchanged"
  | "error"
  | "empty";

export interface ParticipationWorkbookPreviewRow {
  id: number;
  sheetKey: string;
  rowNumber: number;
  unitCode: string;
  unitId: string | null;
  unitName: string;
  participantCount: number | null;
  headcount: number | null;
  percentage: number | null;
  existingParticipantCount: number | null;
  existingPercentage: number | null;
  expectedUpdatedAt: string | null;
  warning: "ZERO_HEADCOUNT" | null;
  status: ParticipationWorkbookActionStatus;
  errorMsg?: string;
}

export interface ParticipationWorkbookPreview {
  stats: {
    total: number;
    first: number;
    unchanged: number;
    correction: number;
    empty: number;
    error: number;
  };
  rows: ParticipationWorkbookPreviewRow[];
}

export interface ParticipationWorkbookCommitRow {
  unitCode: string;
  unitId: string;
  status: "FIRST" | "CORRECTION" | "UNCHANGED";
  participantCount: number;
  percentage: number;
  warning: "ZERO_HEADCOUNT" | null;
  auditId?: string;
}

export interface ParticipationWorkbookCommitResult {
  created: number;
  updated: number;
  skipped: number;
  rows: ParticipationWorkbookCommitRow[];
}

export interface ParticipationPreviewRow extends Omit<
  ParticipationWorkbookPreviewRow,
  "status"
> {
  status: ParticipationStatus;
  sourceStatus: ParticipationWorkbookActionStatus;
}

export interface ParticipationImportStats {
  total: number;
  matched: number;
  conflict: number;
  unchanged: number;
  error: number;
  empty: number;
  first: number;
  correction: number;
}

export type ParticipationImportResult = ParticipationWorkbookCommitResult;

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  percentage: number;
}

export interface ParticipationCategory {
  id: string;
  name: string;
}

export interface ParticipationRankingItem {
  rank: number;
  unitId: string;
  unitName: string;
  unitType: string;
  averagePercentage: number | null;
  hasData: boolean;
  categoriesCount: number;
  categories: CategoryBreakdown[];
}

export interface ParticipationRankingResponse {
  ranking: ParticipationRankingItem[];
  categories: ParticipationCategory[];
  total: number;
}
