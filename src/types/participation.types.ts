export type ParticipationStatus =
  | "matched"
  | "conflict"
  | "unchanged"
  | "error"
  | "empty";

export interface ParticipationPreviewRow {
  id: number;
  unitName: string;
  unitId: string | null;
  percentage: number | null;
  status: ParticipationStatus;
  existingPercentage?: number | null;
  errorMsg?: string;
}

export interface ParticipationImportStats {
  total: number;
  matched: number;
  conflict: number;
  unchanged: number;
  error: number;
  empty: number;
}

export interface ParticipationImportResult {
  created: number;
  updated: number;
  skipped: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  percentage: number;
}

// [UPDATED] Metadata kategori yang ada — untuk build dynamic columns di component
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

// [UPDATED] Wrapper response API ranking — include categories metadata
export interface ParticipationRankingResponse {
  ranking: ParticipationRankingItem[];
  categories: ParticipationCategory[];
  total: number;
}
