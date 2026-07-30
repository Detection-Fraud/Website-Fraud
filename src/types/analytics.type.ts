export interface KegiatanPerPeriode {
  periode: string;
  tahunIni: number;
  tahunLalu: number;
}

export interface TopUnit {
  name: string;
  jumlah: number;
}

export interface DistribusiProgram {
  name: string;
  value: number;
}

export interface DistribusiProgramPerPeriode {
  ALL: DistribusiProgram[];
  TW1: DistribusiProgram[];
  TW2: DistribusiProgram[];
  TW3: DistribusiProgram[];
  TW4: DistribusiProgram[];
  SM1: DistribusiProgram[];
  SM2: DistribusiProgram[];
}

export interface RankingWilayah {
  rank: number;
  name: string;
  unit: number;
  kegiatan: number;
  disetujui: number;
  approvalRate: number;
  status: string;
}

export interface DashboardSummary {
  totalKegiatan: number;
  totalApproved: number;
  totalPending: number;
  totalRejected: number;
  totalUnitAktif: number;
  laporanBulanIni: number;
  laporanBulanLalu: number;
}

export interface RankingCC {
  rank: number;
  userId: string;
  name: string;
  unitName: string;
  unitType: string;
  submitted: number;
  approved: number;
  target: number;
  approvalRate: number;
  status: string;
}

export interface DashboardCharts {
  kegiatanPerBulan: KegiatanPerPeriode[];
  kegiatanPerTriwulan: KegiatanPerPeriode[];
  kegiatanPerSemester: KegiatanPerPeriode[];
  topUnit: TopUnit[];
  distribusiProgram: DistribusiProgram[];
  rankingWilayah: RankingWilayah[];
  rankingTotal: number;
  rankingPage: number;
  rankingTotalPages: number;
  rankingCC: RankingCC[];
  rankingCCTotal: number;
  rankingCCPage: number;
  rankingCCTotalPages: number;
}
export interface DashboardData {
  summary: DashboardSummary;
  charts: DashboardCharts;
}
