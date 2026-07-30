"use client";

import { cn } from "@/lib/utils";
import { Label, ListBox, Select } from "@heroui/react";

interface FilterCategoryProps {
  value: string;
  onChange: (value: string) => void;
  categories: { id: string; name: string }[];
  labelOff?: boolean;
  className?: string;
}

export default function FilterCategory({
  value,
  onChange,
  categories,
  labelOff = false,
  className,
}: FilterCategoryProps) {
  return (
    <div className={cn("w-48", className)}>
      <Select
        aria-label="Filter Kategori"
        placeholder="Semua Kategori"
        value={value || "ALL"}
        onChange={(val) => onChange(val as string)}
      >
        <Label className={labelOff ? "sr-only" : ""}>Kategori</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="ALL" textValue="Semua Kategori">
              Semua Kategori
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {categories.map((cat) => (
              <ListBox.Item key={cat.id} id={cat.id} textValue={cat.name}>
                {cat.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
