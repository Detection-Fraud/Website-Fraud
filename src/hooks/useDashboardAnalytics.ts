"use client";

import { DashboardData } from "@/types/analytics.type";
import { useEffect, useState } from "react";

export function useDashboardAnalytics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [regionId, setRegionId] = useState<string | undefined>(undefined);
  const [programId, setProgramId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("year", String(year));
        if (regionId) params.set("regionId", regionId);
        if (programId) params.set("programId", programId);

        const response = await fetch(
          `/api/analytics/dashboard?${params.toString()}`,
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.message || "Gagal mengambil data analytics");
        }
        setData(json.data);
      } catch (err: any) {
        console.error("Dashboard fetch error: ", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, [year, regionId, programId]);

  return {
    data,
    summary: data?.summary ?? null,
    charts: data?.charts ?? null,
    isLoading,
    error,

    year,
    setYear,
    regionId,
    setRegionId,
    programId,
    setProgramId,

  };
}
