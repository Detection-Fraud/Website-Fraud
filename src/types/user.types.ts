export interface UserUnit {
  id: string;
  name: string;
  type: "KANTOR_WILAYAH" | "KANTOR_CABANG" | "DIVISI" | string;
}

export interface UserWithUnit {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "PIC" | "VIEWER";
  unitId: string | null;
  unit: UserUnit | null;
  createdAt: string;
  isActive: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ManagementUsersResponse {
  user: UserWithUnit[];
  pagination: PaginationMeta;
}
