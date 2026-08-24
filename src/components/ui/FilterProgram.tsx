"use client";

import { useProgramList } from "@/hooks/useProgramList";
import { cn } from "@/lib/utils";
import { ProgramBudaya } from "@generated/prisma";
import { Label, ListBox, Select } from "@heroui/react";

interface FilterProgramProps {
  value: string;
  onChange: (value: string) => void;
  categoryId?: string;
  isDisabled?: boolean;
  labelOff?: boolean;
  className?: string;
}

export default function FilterProgram({
  value,
  onChange,
  categoryId,
  isDisabled = false,
  labelOff = false,
  className,
}: FilterProgramProps) {
  const { programs, isLoading } = useProgramList(categoryId);
  const programList = Array.isArray(programs) ? programs : [];

  const placeholderText = isDisabled
    ? "Pilih Kategori Dahulu"
    : isLoading
      ? "Memuat Program..."
      : "Semua Program";

  return (
    <div className={cn("w-48", className)}>
      <Select
        aria-label="Filter Program"
        placeholder={placeholderText}
        value={value || "ALL"}
        onChange={(key) => onChange((key as string) || "ALL")}
        isDisabled={isDisabled}
      >
        <Label className={labelOff ? "sr-only" : ""}>Program Budaya</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="ALL" textValue="Semua Program">
              <ListBox.ItemIndicator />
              Semua Program
            </ListBox.Item>
            {programList.map((program: ProgramBudaya) => (
              <ListBox.Item
                key={program.id}
                id={program.id}
                textValue={program.name}
              >
                <ListBox.ItemIndicator />
                {program.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
