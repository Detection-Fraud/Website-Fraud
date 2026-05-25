"use client";

import { DashboardData } from "@/types/analytics.type";
import { useEffect, useState } from "react";

export type PeriodeFilter =
  | "ALL"
  | "TW1"
  | "TW2"
  | "TW3"
  | "TW4"
  | "SM1"
  | "SM2";

export function useDashboardAnalytics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState(new Date().getFullYear());
  // === PERUBAHAN: regionId/branchId → kanwilId/kancabId ===
  const [kanwilId, setKanwilId] = useState<string>("ALL");
  const [programId, setProgramId] = useState<string>("ALL");
  const [kancabId, setKancabId] = useState<string>("ALL");

  const [periode, setPeriode] = useState<PeriodeFilter>("ALL");

  useEffect(() => {
    const fetchDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("year", String(year));
        params.set("periode", periode);
        if (kanwilId !== "ALL") params.set("kanwilId", kanwilId);
        if (programId !== "ALL") params.set("programId", programId);
        if (kancabId !== "ALL") params.set("kancabId", kancabId);

        const response = await fetch(
          `/api/analytics/dashboard?${params.toString()}`,
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.message || "Gagal mengambil data analytics");
        }
        setData(json.data);
      } catch (error: unknown) {
        console.error("Dashboard fetch error: ", error);
        setError(error instanceof Error ? error.message : "Terjadi kesalahan");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [year, kanwilId, programId, periode, kancabId]);

  const getAreaChartData = () => {
    const dataBulanan = data?.charts.kegiatanPerBulan;
    if (!dataBulanan) return [];
    switch (periode) {
      case "TW1":
        return dataBulanan.slice(0, 3);
      case "TW2":
        return dataBulanan.slice(3, 6);
      case "TW3":
        return dataBulanan.slice(6, 9);
      case "TW4":
        return dataBulanan.slice(9, 12);
      case "SM1":
        return dataBulanan.slice(0, 6);
      case "SM2":
        return dataBulanan.slice(6, 12);
      default:
        return dataBulanan;
    }
  };

  const getPieChartData = () => data?.charts.distribusiProgram ?? [];

  const calculateDynamicSummary = () => {
    const chartData = getAreaChartData();
    const currentTotal = chartData.reduce(
      (acc, curr) => acc + curr.tahunIni,
      0,
    );
    const prevTotal = chartData.reduce((acc, curr) => acc + curr.tahunLalu, 0);
    return { currentValue: currentTotal, previousValue: prevTotal };
  };

  return {
    data,
    summary: data?.summary ?? null,
    charts: data?.charts ?? null,
    areaChartData: getAreaChartData(),
    pieChartData: getPieChartData(),
    dynamicSummary: calculateDynamicSummary(),
    isLoading,
    error,
    year,
    setYear,
    kanwilId, // dulunya regionId
    setKanwilId, // dulunya setRegionId
    programId,
    setProgramId,
    kancabId, // dulunya branchId
    setKancabId, // dulunya setBranchId
    periode,
    setPeriode,
  };
}
