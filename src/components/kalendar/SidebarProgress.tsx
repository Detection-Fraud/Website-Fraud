import {
  CalendarSubmission,
  CalendarProgramProgress,
  ProgramBand,
} from "@/types/calendar.types";
import { ProgressBar } from "@heroui/react";

interface Props {
  programs: ProgramBand[];
  progress?: CalendarProgramProgress[];
  submissions?: CalendarSubmission[];
  showProgress?: boolean;
  isLoading?: boolean;
  hasLoadError?: boolean;
  isQuarterly?: boolean;
}

export default function SidebarProgress({
  programs,
  progress = [],
  submissions = [],
  showProgress = false,
  isLoading = false,
  hasLoadError = false,
  isQuarterly = false,
}: Props) {
  if (!showProgress) return null;
  return (
    <div className="flex flex-col gap-4 p-4 border rounded-xl bg-white shadow-sm">
      <h3 className="font-bold text-lg">
        {isQuarterly
          ? "Progres Triwulan Ini"
          : "Progress Bulan Ini"}
      </h3>

      {isLoading ? <p className="text-sm text-gray-500">Memuat progres...</p> : null}
      {hasLoadError ? (
        <p className="text-sm text-danger">
          Progres triwulan gagal dimuat. Muat ulang halaman untuk mencoba kembali.
        </p>
      ) : null}

      {!isLoading && !hasLoadError && programs.map((prog) => {
        const approvedCount = isQuarterly
          ? progress.find((item) => item.programId === prog.id)?.approvedCount ?? 0
          : submissions.filter(
              (submission) =>
                submission.programId === prog.id &&
                submission.status === "APPROVED",
            ).length;

        const percentage =
          prog.frequency > 0
            ? Math.round((approvedCount / prog.frequency) * 100)
            : 0;
        let statusColor: "success" | "warning" | "danger" = "success";
        if (percentage < 25) statusColor = "danger";
        else if (percentage < 50) statusColor = "warning";

        return (
          <div key={prog.id} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">{prog.name}</span>
              <span className="text-gray-500">
                {approvedCount} / {prog.frequency} ({percentage}%)
              </span>
            </div>
            <ProgressBar
              size="sm"
              value={Math.min(percentage, 100)}
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
