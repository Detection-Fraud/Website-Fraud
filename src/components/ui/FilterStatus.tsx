"use client";

import { ListBox, Select } from "@heroui/react";

interface FilterStatusProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FilterStatus({ value, onChange }: FilterStatusProps) {
  return (
    <div className="w-48">
      <Select
        aria-label="Filter Status"
        placeholder="Semua Status"
        value={value}
        onChange={(key) => onChange(key as string)}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="ALL" textValue="Semua Status">
              <ListBox.ItemIndicator />
              Semua Status
            </ListBox.Item>
            <ListBox.Item id="PENDING" textValue="Pending">
              <ListBox.ItemIndicator />
              Pending
            </ListBox.Item>
            <ListBox.Item id="APPROVED" textValue="Approved">
              <ListBox.ItemIndicator />
              Approved
            </ListBox.Item>
            <ListBox.Item id="REJECTED" textValue="Rejected">
              <ListBox.ItemIndicator />
              Rejected
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
