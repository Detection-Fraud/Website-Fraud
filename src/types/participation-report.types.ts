export type ParticipationReportStatus =
  | "BELUM_UPLOAD"
  | "PENDING"
  | "REJECTED"
  | "APPROVED_BELUM_DINILAI"
  | "SELESAI";

export type ParticipationType = "VALUE_ONLY" | "WITH_EVIDENCE";

export interface ParticipationReportScore {
  percentage: number;
  assessedBy: { id: string; name: string } | null;
  assessedAt: string | Date | null;
  updatedAt: string | Date | null;
}

export interface ParticipationReportRow {
  key: string;
  unit: { id: string; name: string; type: string; parentId: string | null };
  category: { id: string; name: string };
  program: { id: string; tw: number; year: number };
  participationType: ParticipationType;
  status: ParticipationReportStatus;
  reportId: string | null;
  reportNotes: string | null;
  score: ParticipationReportScore | null;
}

export interface ParticipationReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ParticipationReportResponse {
  data: ParticipationReportRow[];
  pagination: ParticipationReportPagination;
}
