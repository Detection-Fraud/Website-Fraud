import { api } from "@/lib/api";
import { CalendarSubmission } from "@/types/calendar.types";
import { useQuery } from "@tanstack/react-query";

interface CalendarSubmissionsResponse {
  data: CalendarSubmission[];
}

interface Params {
  month: number;
  year: number;
  // === PERUBAHAN: regionId/branchId/divisionId → kanwilId/kancabId/divisiId ===
  kanwilId: string;
  kancabId: string;
  divisiId: string;
}

export function useCalendarSubmissions({
  month,
  year,
  kanwilId,
  kancabId,
  divisiId,
}: Params) {
  const { data, isLoading } = useQuery<CalendarSubmissionsResponse>({
    queryKey: [
      "calendar-submissions",
      { month, year, kanwilId, kancabId, divisiId },
    ],
    queryFn: () =>
      api
        .get("/kalendar/submissions", {
          params: { month, year, kanwilId, kancabId, divisiId },
        })
        .then((res) => res.data),
  });

  return {
    submissions: data?.data ?? ([] as CalendarSubmission[]),
    isLoading,
  };
}
