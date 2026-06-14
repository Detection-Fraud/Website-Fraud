"use client";

import { ListBox, Select, Label } from "@heroui/react";

export type UnitTypeFilter = "ALL" | "WILAYAH" | "CABANG" | "DIVISI";

interface SelectUnitTypeProps {
  value: UnitTypeFilter;
  onChange: (value: UnitTypeFilter) => void;
  className?: string;
}

const UNIT_TYPE_OPTIONS: { id: UnitTypeFilter; label: string }[] = [
  { id: "ALL", label: "Semua Unit" },
  { id: "WILAYAH", label: "Kantor Wilayah" },
  { id: "CABANG", label: "Kantor Cabang" },
  { id: "DIVISI", label: "Divisi" },
];

export default function SelectUnitType({
  value,
  onChange,
  className,
}: SelectUnitTypeProps) {
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
          {UNIT_TYPE_OPTIONS.map((opt) => (
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
