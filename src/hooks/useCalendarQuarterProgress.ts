import { api } from "@/lib/api";
import { CalendarProgramProgress } from "@/types/calendar.types";
import { useQuery } from "@tanstack/react-query";

interface Params {
  month: number;
  year: number;
}

export function useCalendarQuarterProgress({ month, year }: Params) {
  const { data, isLoading, isError } = useQuery<CalendarProgramProgress[]>({
    queryKey: ["calendar-quarter-progress", { month, year }],
    queryFn: () =>
      api
        .get("/kalender/progress", { params: { month, year } })
        .then((res) => res.data),
  });

  return {
    progress: data ?? [],
    isLoading,
    isError,
  };
}
