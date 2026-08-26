"use client";

import CalendarPicker from "@/components/ui/calendar-picker";
import { Button, Description, Label } from "@heroui/react";
import type { DateValue } from "@internationalized/date";
import { FiCalendar, FiGrid } from "react-icons/fi";

const TW_OPTIONS = [
  { key: "1", label: "TW I" },
  { key: "2", label: "TW II" },
  { key: "3", label: "TW III" },
  { key: "4", label: "TW IV" },
] as const;

interface ProgramPeriodFieldsProps {
  selectedTw: string | null;
  onTwChange: (tw: string) => void;
  startDate: DateValue | null;
  onStartDateChange: (value: DateValue | null) => void;
  endDate: DateValue | null;
  onEndDateChange: (value: DateValue | null) => void;
  uploadDeadline: DateValue | null;
  onUploadDeadlineChange: (value: DateValue | null) => void;
  periodError: string | null;
}

export default function ProgramPeriodFields({
  selectedTw,
  onTwChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  uploadDeadline,
  onUploadDeadlineChange,
  periodError,
}: ProgramPeriodFieldsProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-2 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-400">
          <FiCalendar className="size-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold">Periode program</h4>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            TW tidak mengubah tanggal kegiatan.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          <span className="flex items-center gap-1.5">
            <FiGrid className="size-4" /> Triwulan
          </span>
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TW_OPTIONS.map((tw) => (
            <Button
              className="h-11"
              key={tw.key}
              onPress={() => onTwChange(tw.key)}
              type="button"
              variant={selectedTw === tw.key ? "primary" : "secondary"}
            >
              {tw.label}
            </Button>
          ))}
        </div>
        <input name="tw" type="hidden" value={selectedTw ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CalendarPicker
          isRequired
          label="Tanggal mulai kegiatan"
          name="startDatePicker"
          onChange={onStartDateChange}
          value={startDate}
          variant="secondary"
        />
        <CalendarPicker
          isRequired
          label="Tanggal selesai kegiatan"
          name="endDatePicker"
          onChange={onEndDateChange}
          value={endDate}
          variant="secondary"
        />
        <div className="space-y-1 sm:col-span-2">
          <CalendarPicker
            isRequired
            label="Deadline upload"
            name="uploadDeadlinePicker"
            onChange={onUploadDeadlineChange}
            value={uploadDeadline}
            variant="secondary"
          />
          <Description>
            PIC masih dapat mengirim laporan sampai tanggal ini.
          </Description>
        </div>
      </div>

      <input name="startDate" type="hidden" value={startDate?.toString() ?? ""} />
      <input name="endDate" type="hidden" value={endDate?.toString() ?? ""} />
      <input
        name="uploadDeadline"
        type="hidden"
        value={uploadDeadline?.toString() ?? ""}
      />

      {periodError ? (
        <p
          className="text-sm font-medium text-red-600 dark:text-red-400"
          role="alert"
        >
          {periodError}
        </p>
      ) : null}
    </div>
  );
}
