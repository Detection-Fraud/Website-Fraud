import { ImportStats, PreviewRow, RowStatus } from "@/types/import.types";
import StatsBars from "./ImportStats";
import { Button, Card, Chip, Spinner } from "@heroui/react";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiInfo,
} from "react-icons/fi";
import DataTable, { TableColumn } from "@/components/layout/DataTable";

interface PreviewDataStepProps {
  rows: PreviewRow[];
  stats: ImportStats;
  fileName?: string;
  isLoading: boolean;
  errorMsg: string | null;
  onBack: () => void;
  onProsessImport: () => void;
}

const MAX_DISPLAY_ROWS = 100;

const STATUS_CHIP_CONFIG: Record<
  RowStatus,
  { label: string; color: "success" | "warning" | "default" | "danger" }
> = {
  baru: { label: "Baru", color: "success" },
  mutasi: { label: "Mutasi", color: "warning" },
  tidak_berubah: { label: "Tidak Berubah", color: "default" },
  error: { label: "Error", color: "danger" },
};

const COLUMNS: TableColumn[] = [
  { key: "no", label: "#" },
  { key: "status", label: "Status" },
  { key: "nip", label: "NIP" },
  { key: "nama", label: "Nama" },
  { key: "jabatan", label: "Jabatan" },
  { key: "unitKerja", label: "Unit Kerja (Baru)" },
];

export default function PreviewDatStep({
  rows,
  stats,
  fileName,
  isLoading,
  errorMsg,
  onBack,
  onProsessImport,
}: PreviewDataStepProps) {
  const displayRows = rows.slice(0, MAX_DISPLAY_ROWS);
  const hasErrors = stats.error > 0;
  const hasMutasi = stats.mutasi > 0;

  const renderCell = (row: PreviewRow & { _idx: number }, colKey: string) => {
    const chipCfg = STATUS_CHIP_CONFIG[row.status];
    const isMutasi = row.status === "mutasi";
    const isError = row.status === "error";

    switch (colKey) {
      case "no":
        return <span className="text-gray-400 text-xs">{row._idx + 1}</span>;
      case "status":
        return (
          <div className="flex flex-col gap-0.5">
            <Chip size="sm" color={chipCfg.color} className="w-fit">
              <Chip.Label>{chipCfg.label}</Chip.Label>
            </Chip>
            {isError && row.errorMsg && (
              <span className="text-xs text-red-500 mt-0.5">
                {row.errorMsg}
              </span>
            )}

            {isMutasi && row.mutasiInfo && (
              <span className="text-xs text-orange-600 mt-0.5 leading-tight">
                ↪ dari:{" "}
                <span className="font-medium">{row.mutasiInfo.unitLama}</span>
              </span>
            )}
          </div>
        );
      case "nip":
        return (
          <span className="font-mono text-xs text-gray-600">
            {row.nip || "-"}
          </span>
        );
      case "nama":
        return <span className="font-medium text-sm">{row.nama || "-"}</span>;
      case "jabatan":
        return (
          <span className="text-gray-500 text-sm">{row.jabatan || "-"}</span>
        );
      case "unitKerja":
        return (
          <span className="text-gray-500 text-sm">{row.unitKerja || "-"}</span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <StatsBars stats={stats} fileName={fileName} />

      {hasErrors && (
        <Card className="border border-red-200 bg-red-50 p-4 rounded-2xl">
          <Card.Content className="p-0 flex items-start gap-3">
            <FiAlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {stats.error} baris memiliki error dan akan dilewati
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                Hanya <strong>{stats.baru + stats.mutasi} baris valid</strong>{" "}
                yang akan diproses. Baris merah di tabel di bawah tidak akan
                disimpan.
              </p>
            </div>
          </Card.Content>
        </Card>
      )}

      {hasMutasi && (
        <Card className="border border-orange-200 bg-orange-50 p-4 rounded-2xl">
          <Card.Content className="p-0 flex items-start gap-3">
            <FiInfo size={10} className="text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">
                {stats.mutasi} karyawan terdeteksi mutasi unit kerja
              </p>
              <p className="text-xs text-orange-700 mt-0.5">
                Karyawan ini sudah ada di sistem tapi unit kerjanya berbeda
                dengan data di file. Unit akan diperbarui sesuai file baru.
                Lihat kolom <strong>Status</strong> bertanda{" "}
                <span className="font-semibold text-orange-600">[Mutasi]</span>{" "}
                di tabel di bawah untuk detail perubahan unit.
              </p>
            </div>
          </Card.Content>
        </Card>
      )}

      {errorMsg && (
        <Card className="border border-red-300 bg-red-50 p-4 rounded-2xl">
          <Card.Content className="p-0 flex items-start gap-2 text-red-700 text-sm">
            <FiAlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </Card.Content>
        </Card>
      )}

      <Card className="rounded-2xl overflow-hidden ">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Preview Data Karyawan</h3>
          <span className="text-xs text-gray-400">
            Menampilkan {displayRows.length} dari {rows.length} baris
          </span>
        </div>

        <DataTable<PreviewRow & { _idx: number }>
          column={COLUMNS}
          ariaLabel="Preview data karyawan import"
          data={displayRows.map((r, i) => ({ ...r, _idx: i }))}
          renderCell={(row, colKey) => renderCell(row, colKey)}
          className="h-screen"
        />

        <div className="p-5 border-t border-gray-100 flex items-center gap-3 justify-between">
          <Button variant="outline" onPress={onBack}>
            <FiArrowLeft size={14} />
            Pilih File Lain
          </Button>
          <Button
            size="md"
            onPress={onProsessImport}
            isPending={isLoading}
            className={" bg-linear-to-br from-sky-600 to-sky-500 rounded-xl"}
          >
            {({ isPending }) => (
              <>
                {isPending ? (
                  <>
                    <Spinner size="sm" color="current" />
                    Memproses...
                  </>
                ) : (
                  <>
                    Lanjut Import
                    <FiArrowRight size={14} />
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
