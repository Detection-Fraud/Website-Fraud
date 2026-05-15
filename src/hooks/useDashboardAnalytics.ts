"use client";

import { DashboardData } from "@/types/analytics.type";
import { useEffect, useState } from "react";

// 1. Buat tipe spesifik untuk filter periode agar auto-complete jalan
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

  // State untuk Query Params (Backend Filters)
  const [year, setYear] = useState(new Date().getFullYear());
  const [regionId, setRegionId] = useState<string>("ALL");
  const [programId, setProgramId] = useState<string>("ALL");
  const [branchId, setBranchId] = useState<string>("ALL");

  const [periode, setPeriode] = useState<PeriodeFilter>("ALL");

  useEffect(() => {
    const fetchDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("year", String(year));
        params.set("periode", periode);
        if (regionId !== "ALL") params.set("regionId", regionId);
        if (programId !== "ALL") params.set("programId", programId);
        if (branchId !== "ALL") params.set("branchId", branchId);

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

    // 'periode' masuk ke dep array karena distribusiProgram harus di-refetch saat periode berubah
    fetchDashboard();
  }, [year, regionId, programId, periode, branchId]);

  // 3. Helper cerdas penyedia data grafik yang udah mateng
  const getAreaChartData = () => {
    const dataBulanan = data?.charts.kegiatanPerBulan;
    if (!dataBulanan) return [];

    switch (periode) {
      case "TW1":
        return dataBulanan.slice(0, 3); // Jan, Feb, Mar
      case "TW2":
        return dataBulanan.slice(3, 6); // Apr, Mei, Jun
      case "TW3":
        return dataBulanan.slice(6, 9); // Jul, Agu, Sep
      case "TW4":
        return dataBulanan.slice(9, 12); // Okt, Nov, Des
      case "SM1":
        return dataBulanan.slice(0, 6); // Jan - Jun
      case "SM2":
        return dataBulanan.slice(6, 12); // Jul - Des
      case "ALL":
      default:
        return dataBulanan;
    }
  };

  const getPieChartData = () => {
    // API sudah mem-filter berdasarkan periode, tinggal return langsung
    return data?.charts.distribusiProgram ?? [];
  };

  const calculateDynamicSummary = () => {
    const chartData = getAreaChartData();

    const currentTotal = chartData.reduce(
      (acc, curr) => acc + curr.tahunIni,
      0,
    );
    const prevTotal = chartData.reduce((acc, curr) => acc + curr.tahunLalu, 0);

    return {
      currentValue: currentTotal,
      previousValue: prevTotal,
    };
  };

  return {
    data,
    summary: data?.summary ?? null,
    charts: data?.charts ?? null,

    // Export data yang udah difilter, UI tinggal nerima beres
    areaChartData: getAreaChartData(),
    pieChartData: getPieChartData(),

    dynamicSummary: calculateDynamicSummary(),

    isLoading,
    error,

    year,
    setYear,
    regionId,
    setRegionId,
    programId,
    setProgramId,

    branchId,
    setBranchId,

    // Export state periode buat di-binding ke Dropdown HeroUI
    periode,
    setPeriode,
  };
}
