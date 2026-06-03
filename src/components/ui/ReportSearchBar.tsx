"use client";
import { SearchField, SearchFieldGroup } from "@heroui/react";

interface ReportSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
}

export default function ReportSearchBar({
  value,
  onChange,
  onSearch,
  onClear,
}: ReportSearchBarProps) {
  return (
    <SearchField>
      <SearchFieldGroup className="shadow-sm bg-[#f8fafc]">
        <SearchField.SearchIcon />
        <SearchField.Input
          placeholder="Search..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
        <SearchField.ClearButton onClick={onClear} />
      </SearchFieldGroup>
    </SearchField>
  );
}
