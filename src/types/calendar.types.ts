export interface CalendarSubmission {
  id: string;
  tanggalKegiatan: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  programId: string | null;
  unitId: string | null;
}

export interface CalendarProgramProgress {
  programId: string;
  approvedCount: number;
}

export interface ProgramBand {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  frequency: number;
  tw?: number | null;
  color: string;
  categoryName?: string;
  categoryId?: string | null;
}

export interface CalendarSummaryData {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}
