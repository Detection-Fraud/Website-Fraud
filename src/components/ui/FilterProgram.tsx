"use client";

import { useProgramList } from "@/hooks/useProgramList";
import { cn } from "@/lib/utils";
import { Label, ListBox, Select } from "@heroui/react";

interface FilterProgramProps {
  value: string;
  onChange: (value: string) => void;
  labelOff?: boolean;
  className?: string;
}

export default function FilterProgram({
  value,
  onChange,
  labelOff = false,
  className,
}: FilterProgramProps) {
  const { programs } = useProgramList();

  return (
    <div className={cn("w-48", className)}>
      <Select
        aria-label="Filter Program"
        placeholder="Semua Program"
        value={value}
        onChange={(key) => onChange(key as string)}
      >
        <Label className={labelOff ? "sr-only" : ""}>Program</Label>
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
            {programs.map((program) => (
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
