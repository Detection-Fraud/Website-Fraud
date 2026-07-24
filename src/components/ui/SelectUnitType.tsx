"use client";

import { Label, ListBox, Select } from "@heroui/react";

export type UnitTypeFilter =
  | "ALL"
  | "WILAYAH"
  | "CABANG"
  | "DIVISI"
  | "WILAYAH_AND_CABANG";

interface SelectUnitTypeProps {
  value: UnitTypeFilter;
  onChange: (value: UnitTypeFilter) => void;
  className?: string;
  showKanwilAndKancab?: boolean;
}

const UNIT_TYPE_OPTIONS: { id: UnitTypeFilter; label: string }[] = [
  { id: "ALL", label: "Semua Unit" },
  { id: "WILAYAH_AND_CABANG", label: "Kanwil + Kancab" },
  { id: "WILAYAH", label: "Kantor Wilayah" },
  { id: "CABANG", label: "Kantor Cabang" },
  { id: "DIVISI", label: "Divisi" },
];

export default function SelectUnitType({
  value,
  onChange,
  className,
  showKanwilAndKancab = false,
}: SelectUnitTypeProps) {
  const options = UNIT_TYPE_OPTIONS.filter((opt) => {
    if (opt.id === "WILAYAH_AND_CABANG" && !showKanwilAndKancab) {
      return false;
    }
    return true;
  });
  return (
    <Select
      aria-label="Pilih Tipe Unit"
      className={className}
      placeholder="Semua Unit"
      value={value}
      onChange={(key) => onChange((key ?? "ALL") as UnitTypeFilter)}
    >
      <Label>Tipe Unit</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>

      <Select.Popover className={"w-fit max-w-56"}>
        <ListBox>
          {options.map((opt) => (
            <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
              <ListBox.ItemIndicator />
              {opt.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
