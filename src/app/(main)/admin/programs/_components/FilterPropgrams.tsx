"use client";

import { useProgramCategoryQuery } from "@/hooks/useProgramCategoryQuery";
import { Button, ListBox, SearchField, Select } from "@heroui/react";
import {
  FiCalendar,
  FiCheckCircle,
  FiLayers,
  FiRotateCcw,
} from "react-icons/fi";

interface FilterProgramsProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  tw: string;
  onTwChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  totalItems: number;
}

export default function FilterPrograms({
  searchInput,
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  categoryId,
  onCategoryChange,
  tw,
  onTwChange,
  status,
  onStatusChange,
  onResetFilters,
  hasActiveFilters,
  totalItems,
}: FilterProgramsProps) {
  const { data: categories = [] } = useProgramCategoryQuery("KEGIATAN");

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Controls Kiri: Search + Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* 1. Search Bar */}
          <SearchField
            className="w-full sm:w-60"
            value={searchInput}
            onChange={onSearchChange}
            onSubmit={onSearchSubmit}
            onClear={onSearchClear}
          >
            <SearchField.Group className="h-9 w-full rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/50 px-3 text-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
              <SearchField.SearchIcon className="size-3.5 text-zinc-400" />
              <SearchField.Input
                placeholder="Cari nama program..."
                className="text-xs placeholder:text-zinc-400 font-normal"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          {/* Divider vertikal (Desktop) */}
          <div className="hidden sm:block h-5 w-px bg-zinc-200 dark:bg-zinc-800" />

          {/* 2. Filter Kategori */}
          <div className="w-full sm:w-48">
            <Select
              aria-label="Filter Kategori"
              placeholder="Semua Kategori"
              value={categoryId || "ALL"}
              onChange={(val) => onCategoryChange(val as string)}
              className="w-full"
            >
              <Select.Trigger className="h-9 w-full rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/50 px-3 text-xs font-normal text-zinc-700 dark:text-zinc-300 overflow-hidden">
                <Select.Value className="truncate whitespace-nowrap" />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl min-w-[200px]">
                <ListBox className="p-1 text-xs">
                  <ListBox.Item id="ALL" textValue="Semua Kategori">
                    <span className="flex items-center gap-2 font-medium">
                      <FiLayers className="size-3.5 text-zinc-400" />
                      <span>Semua Kategori</span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {categories.map((cat: any) => (
                    <ListBox.Item key={cat.id} id={cat.id} textValue={cat.name}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || "#3B82F6" }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* 3. Filter TW */}
          <div className="w-full sm:w-36">
            <Select
              aria-label="Filter TW"
              placeholder="Semua TW"
              value={tw || "ALL"}
              onChange={(val) => onTwChange(val as string)}
              className="w-full"
            >
              <Select.Trigger className="h-9 w-full rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/50 px-3 text-xs font-normal text-zinc-700 dark:text-zinc-300 overflow-hidden">
                <Select.Value className="truncate whitespace-nowrap" />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl min-w-[180px]">
                <ListBox className="p-1 text-xs">
                  <ListBox.Item id="ALL" textValue="Semua TW">
                    <span className="flex items-center gap-2 font-medium">
                      <FiCalendar className="size-3.5 text-zinc-400" />
                      <span>Semua TW</span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="1" textValue="TW I">
                    <span className="flex items-center justify-between gap-3 w-full">
                      <span className="font-medium">TW I</span>
                      <span className="text-[10px] text-zinc-400">
                        Jan – Mar
                      </span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="2" textValue="TW II">
                    <span className="flex items-center justify-between gap-3 w-full">
                      <span className="font-medium">TW II</span>
                      <span className="text-[10px] text-zinc-400">
                        Apr – Jun
                      </span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="3" textValue="TW III">
                    <span className="flex items-center justify-between gap-3 w-full">
                      <span className="font-medium">TW III</span>
                      <span className="text-[10px] text-zinc-400">
                        Jul – Sep
                      </span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="4" textValue="TW IV">
                    <span className="flex items-center justify-between gap-3 w-full">
                      <span className="font-medium">TW IV</span>
                      <span className="text-[10px] text-zinc-400">
                        Okt – Des
                      </span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* 4. Filter Status */}
          <div className="w-full sm:w-36">
            <Select
              aria-label="Filter Status"
              placeholder="Semua Status"
              value={status || "ALL"}
              onChange={(val) => onStatusChange(val as string)}
              className="w-full"
            >
              <Select.Trigger className="h-9 w-full rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-800/50 px-3 text-xs font-normal text-zinc-700 dark:text-zinc-300 overflow-hidden">
                <Select.Value className="truncate whitespace-nowrap" />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl min-w-[160px]">
                <ListBox className="p-1 text-xs">
                  <ListBox.Item id="ALL" textValue="Semua Status">
                    <span className="flex items-center gap-2 font-medium">
                      <FiCheckCircle className="size-3.5 text-zinc-400" />
                      <span>Semua Status</span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="ACTIVE" textValue="Aktif">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Aktif</span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="INACTIVE" textValue="Nonaktif">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-zinc-400 shrink-0" />
                      <span>Nonaktif</span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* 5. Tombol Reset Filter */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onPress={onResetFilters}
              className="h-9 px-3 text-xs font-medium text-red-600 bg-red-50/80 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/40 rounded-xl flex items-center gap-1.5 transition-colors shadow-none shrink-0"
            >
              <FiRotateCcw className="size-3.5" />
              <span>Reset</span>
            </Button>
          )}
        </div>

        {/* Sisi Kanan: Counter Item */}
        <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50">
            <span>Ditemukan:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {totalItems} program
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
