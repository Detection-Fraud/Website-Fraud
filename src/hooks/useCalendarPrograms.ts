import { api } from "@/lib/api";
import { ProgramBand } from "@/types/calendar.types";
import { useQuery } from "@tanstack/react-query";

interface CalendarProgramsResponse {
  data: ProgramBand[];
}

export function useCalendarPrograms(quarter: number, year: number) {
  const { data, isLoading } = useQuery<CalendarProgramsResponse>({
    queryKey: ["calendar-programs", quarter, year],
    queryFn: () =>
      api
        .get("/kalender/programs", { params: { quarter, year } })
        .then((res) => res.data),
  });

  return {
    programs: data?.data ?? ([] as ProgramBand[]),
    isLoading,
  };
}
