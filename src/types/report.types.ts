export interface ActivityReportItem {
  id: string;
  activityName: string;
  tanggalKegiatan: string;
  lokasi: string;
  picKegiatan: string;
  description: string;
  status: string;
  createdAt: string;
  notes?: string | null;
  region?: { name: string } | null;
  branch?: { name: string } | null;
  division?: { name: string } | null;
  program?: { name: string } | null;
  photos?: {
    id: number;
    originalName: string;
    imageUrl: string;
    publicId?: string | null;
  }[];
  updatedAt?: string;
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
  picKegiatan: string;
  description: string;
  uploadedPhotos?: { originalName: string; imageUrl: string }[];
}

export interface InitialData {
  activityName?: string;
  programId?: string;
  tanggalKegiatan?: string;
  lokasi?: string;
  picKegiatan?: string;
  description?: string;
}
