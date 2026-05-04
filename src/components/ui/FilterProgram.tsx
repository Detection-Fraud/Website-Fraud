"use client";

import { ListBox, Select } from "@heroui/react";
import { useProgram } from "@/hooks/useProgram";

interface FilterProgramProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FilterProgram({ value, onChange }: FilterProgramProps) {
  const { programs } = useProgram();

  return (
    <div className="w-48">
      <Select
        aria-label="Filter Program"
        placeholder="Semua Program"
        value={value}
        onChange={(key) => onChange(key as string)}
      >
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
