export interface KegiatanPerBulan {
  bulan: string;
  jumlah: number;
}

export interface TopUnit {
  name: string;
  jumlah: number;
}

export interface DistribusiProgram {
  name: string;
  value: number;
}

export interface RankingWilayah {
  rank: number;
  name: string;
  jumlah: number;
}

export interface DashboardSummary {
  totalKegiatan: number;
  totalUnitAktif: number;
  laporanBulanIni: number;
}

export interface DashboardCharts {
  kegiatanPerBulan: KegiatanPerBulan[];
  topUnit: TopUnit[];
  distribusiProgram: DistribusiProgram[];
  rankingWilayah: RankingWilayah[];
}

export interface DashboardData {
  summary: DashboardSummary;
  charts: DashboardCharts;
}
