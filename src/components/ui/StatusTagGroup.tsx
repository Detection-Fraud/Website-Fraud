"use client";
import { Tag, TagGroup } from "@heroui/react";

interface StatusTagGroupProps {
  value: string;
  onChange: (status: string) => void;
}

const STATUS_TAGS = [
  { id: "ALL", label: "Semua", activeClass: "data-[selected=true]:bg-sky-500" },
  { id: "PENDING", label: "Pending", activeClass: "data-[selected=true]:bg-amber-500" },
  { id: "APPROVED", label: "Approved", activeClass: "data-[selected=true]:bg-green-500" },
  { id: "REJECTED", label: "Rejected", activeClass: "data-[selected=true]:bg-red-500" },
];

export default function StatusTagGroup({
  value,
  onChange,
}: StatusTagGroupProps) {
  return (
    <TagGroup
      selectedKeys={new Set([value])}
      onSelectionChange={(keys) => {
        const selected = Array.from(keys)[0] as string;
        onChange(selected);
      }}
      aria-label="Filter Status"
      selectionMode="single"
    >
      <TagGroup.List>
        {STATUS_TAGS.map((tag) => (
          <Tag
            key={tag.id}
            id={tag.id}
            className={`${tag.activeClass} data-[selected=true]:text-white px-3 py-1`}
          >
            {tag.label}
          </Tag>
        ))}
      </TagGroup.List>
    </TagGroup>
  );
}
