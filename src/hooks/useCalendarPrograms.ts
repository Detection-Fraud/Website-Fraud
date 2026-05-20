import { ProgramBand } from "@/types/calendar.types";
import { useEffect, useState } from "react";

export function useCalendarPrograms(quarter: number, year: number) {
  const [programs, setPrograms] = useState<ProgramBand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPrograms() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/kalender/programs?quarter=${quarter}&year=${year}`,
        );
        const json = await res.json();

        if (json.data) setPrograms(json.data);
      } catch (error) {
        console.error("Failed to fetch programs", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPrograms();
  }, [quarter, year]);

  return { programs, isLoading };
}
