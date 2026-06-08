import { UNIT_ICON } from "@/constants/users.constants";
import { UnitItem } from "@/hooks/useUnitList";
import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  ListBox,
  SearchField,
  SearchFieldGroup,
} from "@heroui/react";
import { FiMapPin } from "react-icons/fi";

interface UnitListPanelProps {
  units: UnitItem[];
  selectedUnitId: string;
  onSelectUnit: (unitId: string) => void;
  unitType: string;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onAddUser: () => void;
  isLoading?: boolean;
  userCountMap?: Record<string, number>;
}

export default function UnitListPanel({
  units,
  selectedUnitId,
  onSelectUnit,
  unitType,
  searchQuery,
  onSearchChange,
  onAddUser,
  isLoading = false,
  userCountMap = {},
}: UnitListPanelProps) {
  const Icon = UNIT_ICON[unitType] ?? FiMapPin;

  const filtered = units.filter((unit) =>
    unit.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isButtonDisabled = !selectedUnitId || selectedUnitId === "ALL";

  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);

  const unitTypeLabel =
    unitType === "KANWIL"
      ? "Kanwil"
      : unitType === "KANCAB"
        ? "Kancab"
        : "Divisi";

  return (
    <Card className="flex flex-col h-screen border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
      {/* Header */}
      <Card.Header className="flex flex-row items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
        <Card.Title className="text-sm font-semibold text-slate-700">
          Daftar {unitTypeLabel}
        </Card.Title>
        <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-field">
          {filtered.length}
        </span>
      </Card.Header>

      {/* Search */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <SearchField
          className={"w-full"}
          value={searchQuery}
          onChange={(val) => onSearchChange(val)}
        >
          <SearchFieldGroup>
            <SearchField.SearchIcon className="text-slate-400" />
            <SearchField.Input
              placeholder={`Cari Nama ${unitTypeLabel}...`}
              className={"text-sm"}
            />
            <SearchField.ClearButton onClick={() => onSearchChange("")} />
          </SearchFieldGroup>
        </SearchField>
      </div>

      {/* Scrollable list area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-sm text-slate-400">Memuat data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-sm text-slate-400">Tidak ada data unit</p>
          </div>
        ) : (
          <ListBox
            aria-label={`Daftar ${unitTypeLabel}`}
            selectionMode="single"
            selectedKeys={
              selectedUnitId ? new Set([selectedUnitId]) : new Set()
            }
            onSelectionChange={(keys) => {
              const key = [...keys][0];
              if (key) onSelectUnit(String(key));
            }}
            className="w-full py-1"
          >
            {filtered.map((unit) => {
              const picCount = unit._count?.users ?? 0;
              const isActive = unit.id === selectedUnitId;

              return (
                <ListBox.Item
                  key={unit.id}
                  id={unit.id}
                  textValue={unit.name}
                  className={[
                    "w-full flex items-center justify-between px-5 py-3.5",
                    "transition-all duration-150 cursor-pointer outline-none",
                    "border-l-[3px]",
                    isActive
                      ? "border-l-sky-500 bg-sky-50/70"
                      : "border-l-transparent hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon
                      className={
                        isActive
                          ? "w-4 h-4 text-sky-500 shrink-0"
                          : "w-4 h-4 text-slate-400 shrink-0"
                      }
                    />
                    <div className="flex flex-col min-w-0">
                      <span
                        className={[
                          "text-sm font-semibold leading-tight truncate",
                          isActive ? "text-sky-700" : "text-slate-700",
                        ].join(" ")}
                      >
                        {unit.name}
                      </span>
                      <span className="text-xs text-slate-400 mt-0.5 leading-none">
                        {picCount} PIC aktif
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <svg
                      className="w-4 h-4 text-sky-400 shrink-0 ml-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </ListBox.Item>
              );
            })}
          </ListBox>
        )}
      </div>

      {/* Add user footer */}

      <Card.Footer className="pt-3 pb-6">
        <Button
          onClick={onAddUser}
          isDisabled={isButtonDisabled}
          className={cn(
            "py-6 w-[300px] rounded-xl font-semibold transition-all duration-150",
            isButtonDisabled
              ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-80"
              : "bg-linear-to-br from-sky-600 to-sky-500 text-white hover:opacity-90 shadow-sm",
          )}
        >
          <p className="text-wrap">
            Tambah User{selectedUnit ? ` ${selectedUnit.name}` : ""}
          </p>
        </Button>
      </Card.Footer>
    </Card>
  );
}
