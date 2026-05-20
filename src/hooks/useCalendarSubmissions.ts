import { CalendarSubmission } from "@/types/calendar.types";
import { useEffect, useState } from "react";
import { useStackId } from "recharts/types/cartesian/BarStack";

interface Params {
  month: number;
  year: number;
  regionId: string;
  branchId: string;
  divisionId: string;
}

export function useCalendarSubmissions({
  month,
  year,
  regionId,
  branchId,
  divisionId,
}: Params) {
  const [submissions, setSubmissions] = useState<CalendarSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSubmissions() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          month: month.toString(),
          year: year.toString(),
          regionId,
          branchId,
          divisionId,
        });

        const res = await fetch(
          `/api/kalender/submissions?${params.toString()}`,
        );

        const json = await res.json();
        if (json.data) setSubmissions(json.data);
      } catch (error) {
        console.error("Failed to fetch submissions", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSubmissions();
  }, [month, year, regionId, branchId, divisionId]);

  return { submissions, isLoading };
}
