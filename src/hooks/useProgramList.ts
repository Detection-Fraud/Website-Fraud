import { ProgramBudaya } from "@generated/prisma";
import { useEffect, useState } from "react";

export function useProgramList() {
  const [programs, setPrograms] = useState<ProgramBudaya[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        setIsLoading(true);

        const res = await fetch("/api/programs?limit=10");
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message || "Gagal mengambil data program");
        }

        setPrograms(json.data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrograms();
  }, []);

  return {
    programs,
    isLoading,
    error,
  };
}
