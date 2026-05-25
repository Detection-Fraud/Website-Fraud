export interface FilterOption {
  id: string;
  name: string;
}

export type TabUnitType =
  | "NASIONAL"
  | "KANWIL_AND_KANCAB"
  | "KANWIL"
  | "KANCAB"
  | "DIVISI";

export interface ProgramFilterOption extends FilterOption {
  color: string;
}

export interface ComplianceFilterOptions {
  kanwilList: FilterOption[];
  divisiList: FilterOption[];
  kancabList: FilterOption[];
  programList: ProgramFilterOption[];
}

export type UnitType = "KANTOR_WILAYAH" | "KANTOR_CABANG" | "DIVISI";

export interface UnitInfo {
  id: string;
  name: string;
  type: UnitType | string;
  wilayah: string;
}

export interface ProgramComplianceItem {
  programId: string;
  pct: number;
  submitted: number;
  target: number;
}

export interface UnitComplianceRow {
  rank: number;
  unit: UnitInfo;
  programCompliance: ProgramComplianceItem[];
  avg: number;
}

export interface ProgramInfo {
  id: string;
  name: string;
  frequency: number;
  color: string;
}

export interface ComplianceSummary {
  totalUnit: number;
  avgCompliance: number;
  unitOnTrack: number;
  perluPerhatian: number;
  waspada: number;
}

export interface ComplianceResponse {
  cards: ComplianceSummary;
  programs: ProgramInfo[];
  tableData: UnitComplianceRow[];
}

export interface WilayahFilter {
  regionId: string;
  branchId: string;
  divisionId: string;
}
