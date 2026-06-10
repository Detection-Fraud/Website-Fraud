export type RowStatus = "baru" | "mutasi" | "tidak_berubah" | "error";

export interface MutasiInfo {
  unitLama: string;
  unitIdLama: string | null;
}

export interface PreviewRow {
  id: number;
  nip: string;
  nama: string;
  jabatan: string;
  unitKerja: string;
  unitId: string | null;
  wilayah: string;
  status: RowStatus;
  errorMsg: string;
  mutasiInfo: MutasiInfo | null;
}

export interface ImportStats {
  total: number
  baru: number
  mutasi: number
  tidakBerubah: number
  error: number
}

export interface ImportResult {
  created: number
  updated: number
  deactivated: number
}

export type ImportStep = 1 | 2 | 3 | 4