"use client";

import { Label, ListBox, Select } from "@heroui/react";

type DivisiOption = { id: string; name: string };

interface SelectDivisiProps {
  divisiList: DivisiOption[];
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  className?: string;
}

export default function SelectDivisi({
  divisiList,
  value,
  onChange,
  isDisabled,
  className,
}: SelectDivisiProps) {
  return (
    <Select
      aria-label="Pilih Divisi"
      className={className}
      placeholder="Semua Divisi"
      value={value === "ALL" ? "ALL" : value}
      onChange={(key) => onChange((key ?? "ALL") as string)}
    >
      <Label>Divisi</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>

      <Select.Popover className={"w-fit max-w-64"}>
        <ListBox>
          <ListBox.Item id={"ALL"} textValue="Semua Divisi">
            Semua Divisi
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {divisiList.map((divisi) => (
            <ListBox.Item
              key={divisi.id}
              id={String(divisi.id)}
              textValue={divisi.name}
            >
              <ListBox.ItemIndicator />
              {divisi.name}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
