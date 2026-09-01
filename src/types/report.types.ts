import { UnitType } from "@generated/prisma";

export interface ActivityReportItem {
  id: string;
  activityName: string;
  tanggalKegiatan: string | Date;
  lokasi: string;
  description: string;
  status: string;
  createdAt: string;
  notes?: string | null;
  unit?: { name: string; id: string; type: UnitType } | null;
  program?: {
    id: string;
    name: string;
    category?: {
      id: string;
      name: string;
      color?: string | null;
      targetUnit: "KEGIATAN" | "PARTISIPASI_PERSEN";
      evidenceMode: "NONE" | "PHOTO_WITH_AI" | "PHOTO_WITHOUT_AI";
      scoreInputMode: "NONE" | "EXCEL_IMPORT" | "DIRECT_ADMIN";
    } | null;
  } | null;
  createdBy?: { id: string; name: string } | null;
  photos?: {
    id: number;
    originalName: string;
    imageUrl: string;
    publicId?: string | null;
  }[];
  updatedAt?: string;
  logs?: ActivityLogItem[];
}

export interface ActivityLogItem {
  id: string;
  reportId: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "RESUBMITTED";
  notes?: string | null;
  actorName: string;
  actorRole: string;
  createdAt: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SummaryStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface ReportFormData {
  activityName: string;
  programId: string;
  tanggalKegiatan: string;
  lokasi: string;
  description: string;
  uploadedPhotos?: { originalName: string; imageUrl: string }[];
}

export interface InitialData {
  activityName?: string;
  programId?: string;
  tanggalKegiatan?: string;
  lokasi?: string;
  description?: string;
}
