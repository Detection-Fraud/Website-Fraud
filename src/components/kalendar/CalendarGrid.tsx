import { CalendarSubmission, ProgramBand } from "@/types/calendar.types";
import { Tooltip } from "@heroui/react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  format,
} from "date-fns";

interface Props {
  monthDate: Date;
  submissions: CalendarSubmission[];
  programs: ProgramBand[];
  selectedProgramIds: string[];
  showDots?: boolean;
}

function getBandColumns(
  program: ProgramBand,
  daysInGrid: Date[],
): { colStart: number; colEnd: number } | null {
  const progStart = new Date(program.startDate);
  // set time to 0 to compare just dates easily
  progStart.setHours(0, 0, 0, 0);

  const progEnd = new Date(program.endDate);
  progEnd.setHours(23, 59, 59, 999);

  let colStart = -1;
  let colEnd = -1;

  daysInGrid.forEach((day, i) => {
    if (day >= progStart && day <= progEnd) {
      if (colStart === -1) colStart = i;
      colEnd = i;
    }
  });

  if (colStart === -1) return null;
  return { colStart, colEnd };
}

export default function CalendarGrid({
  monthDate,
  submissions,
  programs,
  selectedProgramIds = [],
  showDots = false,
}: Props) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  return (
    <div className="w-full">
      {/* PROGRAM BAND ROWS */}
      <div className="mb-3 space-y-1">
        {programs
          .filter(
            (p) =>
              selectedProgramIds.length === 0 ||
              selectedProgramIds.includes(p.id),
          )
          .map((prog) => {
            const band = getBandColumns(prog, daysInMonth);
            if (!band) return null;

            const totalCols = daysInMonth.length;

            return (
              <div
                key={prog.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${totalCols}, 1fr)`,
                }}
              >
                <div
                  style={{
                    gridColumn: `${band.colStart + 1} / ${band.colEnd + 2}`,
                    backgroundColor: prog.color,
                  }}
                  className="h-3 rounded-full text-[9px] font-medium text-white px-2 flex items-center overflow-hidden whitespace-nowrap"
                  title={prog.name}
                >
                  {prog.name}
                </div>
              </div>
            );
          })}
      </div>

      <div className="grid grid-cols-7 border-b pb-2 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 auto-rows-fr">
        {daysInMonth.map((day, idx) => {
          const daySubmissions = submissions.filter((sub) => {
            const matchDate =
              format(new Date(sub.tanggalKegiatan), "yyyy-MM-dd") ===
              format(day, "yyyy-MM-dd");

            const matchProgram =
              selectedProgramIds.length === 0 ||
              (sub.programId !== null &&
                selectedProgramIds.includes(sub.programId));

            return matchDate && matchProgram;
          });

          return (
            <div
              key={idx}
              className={`min-h-[60px] border rounded-md p-2 flex flex-col ${
                !isSameMonth(day, monthStart)
                  ? "bg-gray-50 text-gray-400"
                  : "bg-white"
              } ${isToday(day) ? "border-primary border-2" : "border-gray-200"}`}
            >
              <div
                className={`text-sm text-center font-medium ${isToday(day) ? "text-white bg-blue-900 rounded-full w-6 h-6 flex items-center justify-center mx-auto" : ""}`}
              >
                {format(day, "d")}
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {showDots &&
                  daySubmissions.map((sub, i) => {
                    const program = programs.find(
                      (p) => p.id === sub.programId,
                    );
                    if (!program) return null;

                    const statusLabel =
                      sub.status === "APPROVED"
                        ? "Disetujui"
                        : sub.status === "PENDING"
                          ? "Menunggu"
                          : "Ditolak";

                    return (
                      <div key={i} className="relative">
                        <Tooltip delay={0}>
                          <Tooltip.Trigger aria-label={`${program.name} - ${statusLabel}`}>
                            {/* DOT */}
                            <div
                              className="w-2.5 h-2.5 rounded-full cursor-default"
                              style={{
                                backgroundColor: program.color,
                                opacity: sub.status === "APPROVED" ? 1 : 0.5,
                              }}
                            />
                          </Tooltip.Trigger>
                          <Tooltip.Content showArrow placement="top">
                            <Tooltip.Arrow />
                            <div className="flex flex-col gap-0.5 py-0.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="inline-block w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: program.color }}
                                />
                                <span className="font-semibold text-xs">{program.name}</span>
                              </div>
                              <p className="text-xs text-muted">{statusLabel}</p>
                            </div>
                          </Tooltip.Content>
                        </Tooltip>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
