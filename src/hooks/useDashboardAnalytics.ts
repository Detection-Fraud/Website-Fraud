"use client";

import { UnitTypeFilter } from "@/components/ui/SelectUnitType";
import { api } from "@/lib/api";
import { DashboardData } from "@/types/analytics.type";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useWilayahFilter } from "./useWilayahFilter";

export type PeriodeFilter =
  | "ALL"
  | "TW1"
  | "TW2"
  | "TW3"
  | "TW4"
  | "SM1"
  | "SM2";

export function useDashboardAnalytics() {
  const wilayah = useWilayahFilter();

  const [extraFilters, setExtraFilters] = useState({
    year: new Date().getFullYear(),
    programId: "ALL",
    periode: "ALL" as PeriodeFilter,
    unitType: "WILAYAH" as UnitTypeFilter,
    rankingPage: 1,
    rankingUnitId: "ALL",
    rankingCCPage: 1,
  });

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: [
      "dashboard",
      wilayah.kanwilId,
      wilayah.kancabId,
      wilayah.divisiId,
      extraFilters,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("year", String(extraFilters.year));
      params.set("periode", extraFilters.periode);
      params.set("unitType", extraFilters.unitType);
      params.set("rankingCCPage", String(extraFilters.rankingCCPage));

      if (wilayah.kanwilId !== "ALL") params.set("kanwilId", wilayah.kanwilId);
      if (extraFilters.programId !== "ALL")
        params.set("programId", extraFilters.programId);
      if (wilayah.kancabId !== "ALL") params.set("kancabId", wilayah.kancabId);
      if (extraFilters.unitType === "DIVISI" && wilayah.divisiId !== "ALL") {
        params.set("divisiId", wilayah.divisiId);
      }
      params.set("rankingPage", String(extraFilters.rankingPage));
      if (extraFilters.rankingUnitId !== "ALL") {
        params.set("rankingUnitId", extraFilters.rankingUnitId);
      }

      const res = await api.get(`/analytics/dashboard?${params.toString()}`);
      return res.data;
    },
  });

  const areaChartData = useMemo(() => {
    const dataBulanan = data?.charts.kegiatanPerBulan;
    if (!dataBulanan) return [];
    switch (extraFilters.periode) {
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
  }, [data, extraFilters.periode]);

  const pieChartData = useMemo(
    () => data?.charts.distribusiProgram ?? [],
    [data],
  );

  const dynamicSummary = useMemo(() => {
    const currentTotal = areaChartData.reduce(
      (acc: number, curr: any) => acc + (curr?.tahunIni || 0),
      0,
    );
    const prevTotal = areaChartData.reduce(
      (acc: number, curr: any) => acc + (curr?.tahunLalu || 0),
      0,
    );
    return { currentValue: currentTotal, previousValue: prevTotal };
  }, [areaChartData]);

  return {
    data,
    summary: data?.summary ?? null,
    charts: data?.charts ?? null,
    areaChartData,
    pieChartData,
    dynamicSummary,
    isLoading,
    error: error ? (error as Error).message : null,

    // Filter wilayah
    ...wilayah,

    // Filter spesifik dashboard
    ...extraFilters,

    // Setters → dispatch actions
    setYear: (v: number) =>
      setExtraFilters((p) => ({
        ...p,
        year: v,
        rankingPage: 1,
        rankingCCPage: 1,
      })),
    setProgramId: (v: string) =>
      setExtraFilters((p) => ({
        ...p,
        programId: v,
        rankingPage: 1,
        rankingCCPage: 1,
      })),
    setPeriode: (v: PeriodeFilter) =>
      setExtraFilters((p) => ({
        ...p,
        periode: v,
        rankingPage: 1,
        rankingCCPage: 1,
      })),
    setUnitType: (v: UnitTypeFilter) =>
      setExtraFilters((p) => ({
        ...p,
        unitType: v,
        rankingPage: 1,
        rankingCCPage: 1,
      })),
    setRankingPage: (v: number) =>
      setExtraFilters((p) => ({ ...p, rankingPage: v })),
    setRankingUnitId: (v: string) =>
      setExtraFilters((p) => ({ ...p, rankingUnitId: v, rankingPage: 1 })),
    setRankingCCPage: (v: number) =>
      setExtraFilters((p) => ({ ...p, rankingCCPage: v })),
  };
}
