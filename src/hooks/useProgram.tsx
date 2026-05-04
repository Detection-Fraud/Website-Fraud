import { useState, useEffect } from "react";

import { ProgramBudaya } from "@generated/prisma";

export function useProgram() {
  const [programs, setPrograms] = useState<ProgramBudaya[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgrms = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/programs");

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.message || "Gagal mengambil data program");
        }

        setPrograms(json.data || []);
        setError(null);
      } catch (error: any) {
        console.error("Fetch Program Error: ", error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgrms();
  }, []);

  return { programs, isLoading, error };
}
