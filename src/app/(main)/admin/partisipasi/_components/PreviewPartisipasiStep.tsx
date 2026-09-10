"use client";

import DataTable, { type TableColumn } from "@/components/layout/DataTable";
import {
  buildParticipationCommitPlan,
  getParticipationStatusLabel,
} from "@/lib/participation-ui";
import type {
  ParticipationImportStats,
  ParticipationPreviewRow,
} from "@/types/participation.types";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Label,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheck,
  FiCheckCircle,
  FiMinusCircle,
  FiXCircle,
} from "react-icons/fi";

const COLUMNS: TableColumn[] = [
  { key: "no", label: "#" },
  { key: "unitName", label: "Nama Unit" },
  { key: "participantCount", label: "Jumlah Partisipasi" },
  { key: "headcount", label: "Jumlah Karyawan" },
  { key: "percentage", label: "Capaian Excel" },
  { key: "existingPercentage", label: "Capaian Saat Ini" },
  { key: "status", label: "Status" },
  { key: "action", label: "Aksi" },
];

interface PreviewPartisipasiStepProps {
  rows: ParticipationPreviewRow[];
  stats: ParticipationImportStats;
  fileName?: string;
  isPending: boolean;
  errorMsg?: string | null;
  onBack: () => void;
  onProsessImport: (
    correctionsConfirmed: boolean,
    reasons: Record<number, string>,
  ) => void;
}

export default function PreviewPartisipasiStep({
  rows,
  stats,
  fileName,
  isPending,
  errorMsg,
  onBack,
  onProsessImport,
}: PreviewPartisipasiStepProps) {
  const [correctionsConfirmed, setCorrectionsConfirmed] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});

  useEffect(() => {
    setCorrectionsConfirmed(false);
    setReasons({});
  }, [rows]);

  const plan = buildParticipationCommitPlan(
    rows,
    correctionsConfirmed,
    reasons,
  );

  const renderCell = (
    row: ParticipationPreviewRow & { _idx: number },
    colKey: string,
  ) => {
    switch (colKey) {
      case "no":
        return <span className="text-xs text-gray-400">{row._idx + 1}</span>;
      case "unitName":
        return (
          <span className="text-xs font-semibold text-gray-800">
            {row.unitName}
          </span>
        );
      case "participantCount":
        return (
          <span className="text-xs font-semibold text-slate-700">
            {row.participantCount ?? "-"}
          </span>
        );
      case "headcount":
        return (
          <span className="text-xs text-slate-600">
            {row.headcount ?? "-"}
          </span>
        );
      case "percentage":
        return (
          <span className="text-xs font-bold text-blue-600">
            {row.percentage == null ? "-" : `${row.percentage}%`}
          </span>
        );
      case "existingPercentage":
        return (
          <span className="text-xs text-gray-500">
            {row.existingPercentage == null
              ? "-"
              : `${row.existingPercentage}%`}
          </span>
        );
      case "status":
        return (
          <div className="space-y-1">
            <Chip
              color={
                row.sourceStatus === "ERROR"
                  ? "danger"
                  : row.sourceStatus === "CORRECTION"
                    ? "warning"
                    : row.sourceStatus === "FIRST"
                      ? "success"
                      : "default"
              }
              size="sm"
            >
              <Chip.Label>
                {getParticipationStatusLabel(row.sourceStatus)}
              </Chip.Label>
            </Chip>
            {row.warning === "ZERO_HEADCOUNT" && (
              <p className="text-[11px] text-amber-700">
                Peringatan: headcount 0
              </p>
            )}
            {row.errorMsg && (
              <p className="text-[11px] text-red-700">{row.errorMsg}</p>
            )}
          </div>
        );
      case "action":
        return row.sourceStatus === "CORRECTION" ? (
          <div className="min-w-52 space-y-2">
            <TextField
              aria-label={`Alasan koreksi ${row.unitName}`}
              value={reasons[row.id] ?? ""}
              onChange={(value) =>
                setReasons((current) => ({
                  ...current,
                  [row.id]: value,
                }))
              }
            >
              <Label className="text-xs">Alasan koreksi (wajib)</Label>
              <TextArea rows={2} placeholder="Jelaskan alasan koreksi" />
            </TextField>
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        );
      default:
        return null;
    }
  };

  const correctionRows = rows.filter(
    (row) => row.sourceStatus === "CORRECTION",
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Data Baru", value: stats.first, icon: <FiCheckCircle /> },
          { label: "Sama", value: stats.unchanged, icon: <FiMinusCircle /> },
          { label: "Koreksi", value: stats.correction, icon: <FiAlertTriangle /> },
          { label: "Error", value: stats.error, icon: <FiXCircle /> },
          { label: "Kosong", value: stats.empty, icon: <FiMinusCircle /> },
        ].map((item) => (
          <Card
            key={item.label}
            className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {item.label}
              </span>
              {item.icon}
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-800">
              {item.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold text-gray-800">
              Preview Data ({fileName || "Excel File"})
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Menampilkan {rows.length} baris data partisipasi
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onPress={onBack}
              isDisabled={isPending}
            >
              <FiArrowLeft size={14} />
              Kembali
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={() =>
                onProsessImport(correctionsConfirmed, reasons)
              }
              isPending={isPending}
              isDisabled={isPending || Boolean(plan.error)}
            >
              {({ isPending: buttonPending }) => (
                <>
                  {buttonPending ? (
                    <>
                      <Spinner size="sm" color="current" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <FiCheck size={14} />
                      Proses Import ({plan.actionableCount})
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>

        {errorMsg && (
          <p role="alert" className="px-5 pt-3 text-sm text-danger">
            {errorMsg}
          </p>
        )}

        {correctionRows.length > 0 && (
          <div className="m-5 mb-0 flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800">
            <span>
              <FiAlertTriangle
                className="mr-2 inline text-amber-600"
                size={14}
              />
              Setiap koreksi wajib memiliki alasan dan konfirmasi sebelum
              disimpan.
            </span>
            <Checkbox
              isSelected={correctionsConfirmed}
              onChange={(selected) => setCorrectionsConfirmed(selected)}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="font-medium text-amber-900 text-xs">
                  Konfirmasi seluruh koreksi
                </span>
              </Checkbox.Content>
            </Checkbox>
          </div>
        )}

        {plan.error && (
          <p role="alert" className="px-5 pt-3 text-sm text-danger">
            {plan.error}
          </p>
        )}

        <DataTable<ParticipationPreviewRow & { _idx: number }>
          column={COLUMNS}
          ariaLabel="Tabel preview data partisipasi import"
          data={rows.map((row, index) => ({ ...row, _idx: index }))}
          renderCell={renderCell}
        />
      </Card>
    </div>
  );
}
