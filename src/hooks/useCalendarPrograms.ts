import { api } from "@/lib/api";
import { ProgramBand } from "@/types/calendar.types";
import { useQuery } from "@tanstack/react-query";

export function useCalendarPrograms(quarter: number, year: number) {
  const { data, isLoading } = useQuery<ProgramBand[]>({
    queryKey: ["calendar-programs", quarter, year],
    queryFn: () =>
      api
        .get("/kalender/programs", { params: { quarter, year } })
        .then((res) => res.data),
  });

  return {
    programs: data ?? ([] as ProgramBand[]),
    isLoading,
  };
}
