import { ProgramBand, CalendarSubmission } from "@/types/calendar.types";
import { ProgressBar } from "@heroui/react";

interface Props {
  programs: ProgramBand[];
  submissions: CalendarSubmission[];
  showProgress?: boolean;
}

export default function SidebarProgress({
  programs,
  submissions,
  showProgress = false,
}: Props) {
  if (!showProgress) return null;
  return (
    <div className="flex flex-col gap-4 p-4 border rounded-xl bg-white shadow-sm">
      <h3 className="font-bold text-lg">Progress Bulan Ini</h3>

      {programs.map((prog) => {
        const approvedCount = submissions.filter(
          (s) => s.programId === prog.id && s.status === "APPROVED",
        ).length;

        const percentage =
          prog.frequency > 0
            ? Math.min(Math.round((approvedCount / prog.frequency) * 100), 100)
            : 0;
        let statusColor: "success" | "warning" | "danger" = "success";
        if (percentage < 25) statusColor = "danger";
        else if (percentage < 50) statusColor = "warning";

        return (
          <div key={prog.id} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">{prog.name}</span>
              <span className="text-gray-500">
                {approvedCount} / {prog.frequency}
              </span>
            </div>
            <ProgressBar
              size="sm"
              value={percentage}
              color={statusColor}
              className="w-full"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
        );
      })}
    </div>
  );
}
