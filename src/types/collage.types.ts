export interface CollageCategoryOption {
  id: string;
  name: string;
}

export interface CollageProgramOption {
  id: string;
  name: string;
  tw: number | null;
  startDate: string;
  endDate: string;
  category: CollageCategoryOption;
}

export interface CollageOptionsPayload {
  unit: { id: string; name: string };
  categories: CollageCategoryOption[];
  programs: CollageProgramOption[];
}

export interface CollagePhotoItem {
  id: number;
  imageUrl: string;
  originalName: string;
  report: {
    id: string;
    activityName: string;
    tanggalKegiatan: string;
    lokasi: string;
    picName: string;
  };
}

export interface CollageGalleryPayload {
  items: CollagePhotoItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
