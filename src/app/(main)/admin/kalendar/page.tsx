"use client";

import CalendarGrid from "@/components/kalendar/CalendarGrid";
import AppBar from "@/components/layout/Appbar";
import { useCalendarPrograms } from "@/hooks/useCalendarPrograms";
import { useCalendarSubmissions } from "@/hooks/useCalendarSubmissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ProgramBand } from "@/types/calendar.types";
import { Button, Tag, TagGroup } from "@heroui/react";
import { addMonths, format, subMonths } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { PiCaretLeft, PiCaretRight } from "react-icons/pi";

export default function KalendarPage() {
  const { user } = useCurrentUser();

  const [currentDate, setCurrentDate] = useState(new Date());

  //Handlers cascading

  const handlePrevMonth = () => {
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const { programs, isLoading: loadProg } = useCalendarPrograms(1, 2026);
  const { submissions, isLoading: loadSub } = useCalendarSubmissions({
    month: currentDate.getMonth(),
    year: currentDate.getFullYear(),
    kanwilId: "ALL",
    kancabId: "ALL",
    divisiId: "ALL",
  });

  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>(
    programs.map((p: any) => String(p.id)),
  );

  return (
    <div className="flex flex-col gap-6">
      <AppBar
        title="Kalender Kegiatan"
        description="Jadwal dan pengingat kegiatan program budaya BULOG"
        showAddButton={false}
      />

      {/* FILTER AREA */}
      <div className="flex flex-wrap gap-3 p-4 bg-white border rounded-xl shadow-sm">
        <TagGroup
          selectionMode="multiple"
          selectedKeys={new Set(selectedProgramIds)}
          onSelectionChange={(keys) => {
            setSelectedProgramIds(Array.from(keys) as string[]);
          }}
          aria-label="Filter Program"
        >
          <TagGroup.List>
            {programs.map((prog: ProgramBand) => (
              <Tag
                key={prog.id}
                id={prog.id}
                style={
                  selectedProgramIds.includes(prog.id)
                    ? {
                        backgroundColor: prog.color,
                        color: "white",
                        borderColor: prog.color,
                      }
                    : { borderColor: prog.color, color: prog.color }
                }
              >
                {prog.categoryName
                  ? `[${prog.categoryName}] ${prog.name}`
                  : prog.name}
              </Tag>
            ))}
          </TagGroup.List>
        </TagGroup>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* KALENDER (GRID) */}
        <div className="w-full lg:flex-1 bg-white p-4 border rounded-xl shadow-sm">
          {/* -- HEADER NAVIGASI BULAN -- */}
          <div className="flex items-center justify-between mb-4">
            <Button isIconOnly variant="ghost" onPress={handlePrevMonth}>
              <PiCaretLeft size={20} />
            </Button>
            <h2 className="text-lg font-bold">
              {/* Menggunakan locale id agar tampil "Mei 2026", dsb */}
              {format(currentDate, "MMMM yyyy", { locale: id })}
            </h2>
            <Button isIconOnly variant="ghost" onPress={handleNextMonth}>
              <PiCaretRight size={20} />
            </Button>
          </div>
          {/* -- SELESAI HEADER -- */}
          {loadProg || loadSub ? (
            <p>Memuat Kalender...</p>
          ) : (
            <CalendarGrid
              monthDate={currentDate}
              programs={programs}
              submissions={submissions}
              selectedProgramIds={selectedProgramIds}
              showDots={user?.role === "PIC"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
