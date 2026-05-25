export interface CalendarSubmission {
  id: string;
  tanggalKegiatan: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  programId: string | null;
  unitId: string | null;
}

export interface ProgramBand {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  frequency: number;
  color: string;
}

export interface CalendarSummaryData {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}
