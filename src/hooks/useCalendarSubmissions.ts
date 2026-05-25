import { CalendarSubmission } from "@/types/calendar.types";
import { useEffect, useState } from "react";

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
  const [submissions, setSubmissions] = useState<CalendarSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSubmissions() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          month: month.toString(),
          year: year.toString(),
          kanwilId,
          kancabId,
          divisiId,
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
  }, [month, year, kanwilId, kancabId, divisiId]);

  return { submissions, isLoading };
}
