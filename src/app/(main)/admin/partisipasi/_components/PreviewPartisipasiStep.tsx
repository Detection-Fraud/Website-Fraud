"use client";

import DataTable, { TableColumn } from "@/components/layout/DataTable";
import {
  ParticipationImportStats,
  ParticipationPreviewRow,
} from "@/types/participation.types";
import { Button, Card, Checkbox, Chip } from "@heroui/react";
import { useState } from "react";
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
  { key: "percentage", label: "Capaian Excel" },
  { key: "existingPercentage", label: "Capaian Saat Ini" },
  { key: "status", label: "Status" },
  { key: "action", label: "Aksi" },
];

interface PreviewPartisipasiStepProps {
  rows: ParticipationPreviewRow[];
  stats: ParticipationImportStats;
  fileName?: string;
  onBack: () => void;
  onProsessImport: (overwriteConflictIds: Set<number>) => void;
}

export default function PreviewPartisipasiStep({
  rows,
  stats,
  fileName,
  onBack,
  onProsessImport,
}: PreviewPartisipasiStepProps) {
  const [overwriteConflictIds, setOverwriteConflictIds] = useState<Set<number>>(
    () => {
      const initial = new Set<number>();
      rows.forEach((r) => {
        if (r.status === "conflict") initial.add(r.id);
      });
      return initial;
    },
  );

  const toggleOverwrite = (id: number) => {
    setOverwriteConflictIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllConflict = (selectAll: boolean) => {
    const next = new Set(overwriteConflictIds);
    rows.forEach((r) => {
      if (r.status === "conflict") {
        if (selectAll) next.add(r.id);
        else next.delete(r.id);
      }
    });
    setOverwriteConflictIds(next);
  };

  const commitCount = stats.matched + overwriteConflictIds.size;
  const allConflictSelected =
    stats.conflict > 0 &&
    rows
      .filter((r) => r.status === "conflict")
      .every((r) => overwriteConflictIds.has(r.id));

  const renderCell = (
    row: ParticipationPreviewRow & { _idx: number },
    colKey: string,
  ) => {
    switch (colKey) {
      case "no":
        return <span className="text-gray-400 text-xs">{row._idx + 1}</span>;
      case "unitName":
        return (
          <span className="font-semibold text-gray-800 text-xs">
            {row.unitName}
          </span>
        );
      case "percentage":
        return (
          <span className="font-bold text-blue-600 text-xs">
            {row.percentage !== null ? `${row.percentage}%` : "-"}
          </span>
        );
      case "existingPercentage":
        return (
          <span className="text-xs text-gray-500">
            {row.existingPercentage !== null &&
            row.existingPercentage !== undefined
              ? `${row.existingPercentage}%`
              : "-"}
          </span>
        );
      case "status":
        return (
          <div>
            {row.status === "matched" && (
              <Chip color="success" size="sm">
                <Chip.Label className="inline-flex items-center gap-1">
                  <FiCheckCircle size={12} /> Matched
                </Chip.Label>
              </Chip>
            )}
            {row.status === "unchanged" && (
              <Chip
                color="default"
                size="sm"
                className="bg-slate-100 text-slate-600 border border-slate-200"
              >
                <Chip.Label className="inline-flex items-center gap-1">
                  <FiMinusCircle size={12} /> Sama (Di-skip)
                </Chip.Label>
              </Chip>
            )}
            {row.status === "conflict" && (
              <Chip color="warning" size="sm">
                <Chip.Label className="inline-flex items-center gap-1">
                  <FiAlertTriangle size={12} /> Ada Data
                </Chip.Label>
              </Chip>
            )}
            {row.status === "error" && (
              <Chip color="danger" size="sm">
                <Chip.Label>{row.errorMsg || "Tidak Valid"}</Chip.Label>
              </Chip>
            )}
            {row.status === "empty" && (
              <Chip color="default" size="sm">
                <Chip.Label>Kosong</Chip.Label>
              </Chip>
            )}
          </div>
        );
      case "action":
        return row.status === "conflict" ? (
          <Checkbox
            isSelected={overwriteConflictIds.has(row.id)}
            onChange={() => toggleOverwrite(row.id)}
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span className="text-xs font-medium text-gray-700">
                Timpa Data
              </span>
            </Checkbox.Content>
          </Checkbox>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* [UPDATED] Sleek 5-column summary metrics — no bloated 4px borders */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Data Baru */}
        <Card className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Data Baru
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <FiCheckCircle size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{stats.matched}</p>
        </Card>

        {/* Sama / Di-skip */}
        <Card className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Sama (Skip)
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0">
              <FiMinusCircle size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-700 mt-2">
            {stats.unchanged || 0}
          </p>
        </Card>

        {/* Berubah / Timpa */}
        <Card className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Berubah
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
              <FiAlertTriangle size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {stats.conflict}
          </p>
        </Card>

        {/* Error */}
        <Card className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Error
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
              <FiXCircle size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{stats.error}</p>
        </Card>

        {/* Kosong */}
        <Card className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Kosong
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 border border-slate-200/60 flex items-center justify-center shrink-0">
              <FiMinusCircle size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-400 mt-2">{stats.empty}</p>
        </Card>
      </div>

      {/* TABLE SECTION (REUSE shared DataTable component) */}
      <Card className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-gray-100 gap-3">
          <div>
            <h3 className="font-bold text-gray-800 text-base">
              Preview Data ({fileName || "Excel File"})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Menampilkan {rows.length} baris data partisipasi
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onPress={onBack}
              className="font-medium"
            >
              <FiArrowLeft size={14} /> Kembali
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={() => onProsessImport(overwriteConflictIds)}
              isDisabled={commitCount === 0}
              className="font-semibold shadow-sm"
            >
              <FiCheck size={14} /> Proses Import ({commitCount} Data)
            </Button>
          </div>
        </div>

        {stats.conflict > 0 && (
          <div className="m-5 mb-0 flex items-center justify-between bg-amber-50/80 border border-amber-200/60 rounded-xl px-4 py-2.5 text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <FiAlertTriangle className="shrink-0 text-amber-600" size={14} />
              <span>
                Terdapat <strong>{stats.conflict} data konflik</strong> (sudah
                pernah diimport). Pilih data mana yang ingin ditimpa.
              </span>
            </div>
            <Checkbox
              isSelected={allConflictSelected}
              onChange={handleSelectAllConflict}
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="font-medium text-amber-900 text-xs">
                  Pilih Semua Timpa
                </span>
              </Checkbox.Content>
            </Checkbox>
          </div>
        )}

        <DataTable<ParticipationPreviewRow & { _idx: number }>
          column={COLUMNS}
          ariaLabel="Tabel preview data partisipasi import"
          data={rows.map((r, i) => ({ ...r, _idx: i }))}
          renderCell={(row, colKey) => renderCell(row, colKey)}
        />
      </Card>
    </div>
  );
}
