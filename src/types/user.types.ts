export type UserRole = "ADMIN" | "PIC" | "VIEWER";

export type AuthProvider = "SSO" | "LOCAL";

export type UnitType = "KANTOR_WILAYAH" | "KANTOR_CABANG" | "DIVISI";

export interface UserUnit {
  id: string;
  name: string;
  type: UnitType;
}

export interface UserLinkSummary {
  id: string;
  name: string;
  username: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  unitId: string | null;
  unit: UserUnit | null;
  isActive: boolean;
}

export interface EmployeeAccount {
  id: string;
  nip: string;
  name: string;
  jenjang: string;
  kodeStatpeg: string;
  statKepeg: string;
  unitId: string | null;
  unit: UserUnit | null;
  isPresentInSource: boolean;
  employmentActive: boolean;
  picEligible: boolean;
  user: UserLinkSummary | null;
}

export type EmployeeSourceFilter = "ALL" | "PRESENT" | "ABSENT";

export type EmployeeEmploymentFilter = "ALL" | "ACTIVE" | "INACTIVE";

export type EmployeeAccountFilter =
  | "ALL"
  | "LINKED"
  | "UNLINKED"
  | "ACTIVE"
  | "INACTIVE";

export type EmployeeRoleFilter = "ALL" | UserRole;

export interface EmployeeManagementQuery {
  search: string;
  source: EmployeeSourceFilter;
  employment: EmployeeEmploymentFilter;
  account: EmployeeAccountFilter;
  role: EmployeeRoleFilter;
  page: number;
  limit: number;
}

export interface EmployeeManagementResponse {
  employees: EmployeeAccount[];
  pagination: PaginationMeta;
}

export interface UserAccount {
  id: string;
  name: string;
  username: string | null;
  role: UserRole;
  authProvider: AuthProvider;
  isActive: boolean;
  unitId: string | null;
  unit: UserUnit | null;
  employeeId: string | null;
  employee: EmployeeAccount | null;
  createdAt: string;
}

export interface UserWithUnit {
  id: string;
  name: string;
  username: string | null;
  role: UserRole;
  authProvider: AuthProvider;
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
  users: UserWithUnit[];
  pagination: PaginationMeta;
}
