"use client";

import DataTable from "@/components/layout/DataTable";
import { UNIT_ICON } from "@/constants/users.constants";
import { PaginationMeta, UserWithUnit } from "@/types/user.types";
import { Button, Card, SearchField, SearchFieldGroup } from "@heroui/react";
import { FiEdit2 } from "react-icons/fi";
import { RiDeleteBinLine, RiToggleFill, RiToggleLine } from "react-icons/ri";

const COLUMNS = [
  { key: "no", label: "NO" },
  { key: "nip", label: "NIP" },
  { key: "name", label: "NAMA PIC" },
  { key: "status", label: "STATUS" },
  { key: "aksi", label: "AKSI" },
];

interface UserTablePanelProps {
  unit: {
    id: string;
    name: string;
    type: string;
  } | null;
  unitType: string;
  users: UserWithUnit[];
  pagination: PaginationMeta;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onToggleStatus: (user: UserWithUnit, newStatus: boolean) => void;
  isUpdatingStatus: string | null;
  onDelete: (user: UserWithUnit) => void;
}

function getInitial(name: string): string {
  return name?.charAt(0)?.toUpperCase() ?? "?";
}

export default function UserTablePanel({
  unit,
  unitType,
  users,
  pagination,
  isLoading,
  searchQuery,
  onSearchChange,
  onPageChange,
  onToggleStatus,
  isUpdatingStatus,
  onDelete,
}: UserTablePanelProps) {
  const Icon = UNIT_ICON[unitType] || UNIT_ICON["KANWIL"];

  function renderCell(item: UserWithUnit, columnKey: string): React.ReactNode {
    const index = users.indexOf(item);

    switch (columnKey) {
      case "no":
        return (
          <span className="text-slate-500 text-xs font-medium tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
        );
      case "nip":
        return (
          <span className="inline-block text-slate-700 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md font-semibold">
            {item.username ?? "-"}
          </span>
        );
      case "name":
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-white text-xs font-bold shrink-0 flex items-center justify-center shadow-xs">
              {getInitial(item.name)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 leading-tight">
                {item.name}
              </span>
            </div>
          </div>
        );
      case "status":
        return item.isActive ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Aktif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
            Nonaktif
          </span>
        );
      case "aksi":
        const isCurrentlyUpdating = isUpdatingStatus === item.id;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={item.isActive ? "primary" : "secondary"}
              className={
                item.isActive
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold border border-slate-200/80 rounded-xl shadow-xs active:scale-[0.98] transition-all"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold border border-emerald-200/60 rounded-xl shadow-xs active:scale-[0.98] transition-all"
              }
              isPending={isCurrentlyUpdating}
              onPress={() => onToggleStatus(item, !item.isActive)}
            >
              {item.isActive ? (
                <>
                  <RiToggleFill className="w-4 h-4 text-slate-500" />
                  Nonaktifkan
                </>
              ) : (
                <>
                  <RiToggleLine className="w-4 h-4 text-emerald-600" />
                  Aktifkan
                </>
              )}
            </Button>
            {/* UPDATED: Rose Soft Delete Button */}
            <Button
              onClick={() => onDelete(item)}
              isIconOnly
              size="sm"
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 rounded-xl p-2 transition-all active:scale-95 shadow-xs"
            >
              <RiDeleteBinLine className="w-4 h-4" />
            </Button>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <Card className="flex flex-col h-[calc(100vh-160px)] min-h-[580px] border border-slate-200/60 shadow-surface hover:shadow-surface-md transition-all duration-200 rounded-2xl overflow-hidden bg-white">
      <Card.Header className="flex items-center justify-between flex-row px-6 py-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-sky-50 text-sky-700 rounded-xl shrink-0 border border-sky-100">
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Daftar PIC Aktif
            </p>
            <p className="text-base font-bold text-slate-900 leading-tight mt-0.5">
              {unit?.name ?? "Pilih unit terlebih dahulu"}
            </p>
          </div>
        </div>

        {unit && (
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide leading-none">
              Total PIC
            </span>
            <span className="text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">
              {pagination.total}
            </span>
          </div>
        )}
      </Card.Header>

      {unit && (
        <div className="px-6 py-3 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <SearchField
            className="w-full"
            value={searchQuery}
            onChange={(val) => onSearchChange(val)}
          >
            <SearchFieldGroup className="bg-white border-slate-200 rounded-xl shadow-xs">
              <SearchField.SearchIcon className="text-slate-400" />
              <SearchField.Input
                placeholder="Cari nama atau NIP PIC..."
                className="text-sm text-slate-800"
              />
              <SearchField.ClearButton onClick={() => onSearchChange("")} />
            </SearchFieldGroup>
          </SearchField>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!unit ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 p-8 text-center">
            <Icon className="w-10 h-10 opacity-30 text-slate-400" />
            <p className="text-sm font-medium">
              Pilih unit dari panel kiri untuk melihat daftar PIC
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400 font-medium">Memuat data...</p>
          </div>
        ) : (
          <DataTable
            column={COLUMNS}
            data={users}
            ariaLabel="Tabel Daftar PIC"
            renderCell={renderCell}
            pagination={pagination}
            onPageChange={onPageChange}
          />
        )}
      </div>
    </Card>
  );
}
