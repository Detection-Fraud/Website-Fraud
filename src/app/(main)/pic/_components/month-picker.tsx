"use client";

import { Button, Popover } from "@heroui/react";
import { CalendarDate, DateValue } from "@internationalized/date";
import { useState, useEffect } from "react";
import { PiCalendarBlank, PiCaretLeft, PiCaretRight } from "react-icons/pi";

interface MonthPickerProps {
  value: DateValue | null;
  onChange: (value: DateValue | null) => void;
  label?: string;
  isRequired?: boolean;
}

const BULAN_INDO = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export default function MonthPicker({
  value,
  onChange,
  label,
  isRequired = false,
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(
    value?.year ?? new Date().getFullYear()
  );

  // Sync currentYear with external value when it changes
  useEffect(() => {
    if (value) {
      setCurrentYear(value.year);
    }
  }, [value]);

  const handleSelectMonth = (monthIndex: number) => {
    // day is always 1 for monthly period
    const newDate = new CalendarDate(currentYear, monthIndex + 1, 1);
    onChange(newDate);
    setIsOpen(false);
  };

  const selectedMonthText = value
    ? `${BULAN_INDO[value.month - 1]} ${value.year}`
    : "";

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <span className="text-xs font-medium text-slate-700">
          {label} {isRequired && <span className="text-red-500">*</span>}
        </span>
      )}

      <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger>
          <Button
            type="button"
            variant="secondary"
            className="flex items-center justify-between w-full h-10 px-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-hidden transition-all active:scale-[0.98]"
            aria-label={label || "Pilih Bulan dan Tahun"}
          >
            <span className={selectedMonthText ? "text-slate-800 text-sm font-medium" : "text-slate-400 text-sm"}>
              {selectedMonthText || "Pilih Bulan & Tahun..."}
            </span>
            <PiCalendarBlank className="w-4 h-4 text-slate-400 shrink-0" />
          </Button>
        </Popover.Trigger>

        <Popover.Content placement="bottom start" className="p-3 w-64 border border-slate-100 rounded-xl shadow-lg bg-white">
          <Popover.Dialog className="w-full">
            {/* Header: Year Navigator */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <Button
                size="sm"
                isIconOnly
                variant="ghost"
                className="w-7 h-7 hover:bg-slate-100 rounded-lg active:scale-95 transition-transform"
                onPress={() => setCurrentYear((y) => y - 1)}
                aria-label="Tahun Sebelumnya"
              >
                <PiCaretLeft className="w-4 h-4 text-slate-600" />
              </Button>
              <span className="text-sm font-bold text-slate-800 select-none">
                {currentYear}
              </span>
              <Button
                size="sm"
                isIconOnly
                variant="ghost"
                className="w-7 h-7 hover:bg-slate-100 rounded-lg active:scale-95 transition-transform"
                onPress={() => setCurrentYear((y) => y + 1)}
                aria-label="Tahun Selanjutnya"
              >
                <PiCaretRight className="w-4 h-4 text-slate-600" />
              </Button>
            </div>

            {/* Grid 3x4 of Months */}
            <div className="grid grid-cols-3 gap-1.5">
              {BULAN_INDO.map((bulan, index) => {
                const isSelected =
                  value?.month === index + 1 && value?.year === currentYear;

                return (
                  <Button
                    key={bulan}
                    type="button"
                    size="sm"
                    variant={isSelected ? "primary" : "ghost"}
                    className={`h-9 text-xs font-semibold rounded-lg transition-all active:scale-95 ${
                      isSelected
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                    onPress={() => handleSelectMonth(index)}
                  >
                    {bulan.substring(0, 3)}
                  </Button>
                );
              })}
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
}
