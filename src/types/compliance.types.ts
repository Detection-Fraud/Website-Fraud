export interface FilterOption {
  id: string;
  name: string;
}

export type TabUnitType =
  | "NASIONAL"
  | "REGION_AND_BRANCH"
  | "REGION"
  | "BRANCH"
  | "DIVISION";

export interface ProgramFilterOption extends FilterOption {
  color: string;
}

export interface ComplianceFilterOptions {
  regionsList: FilterOption[];
  divisionList: FilterOption[];
  programList: ProgramFilterOption[];
}

export type UnitType = "REGION" | "BRANCH" | "DIVISION";

export interface UnitInfo {
  id: string;
  name: string;
  type: UnitType;
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
