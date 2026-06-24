"use client";

import { UnitTypeFilter } from "@/components/ui/SelectUnitType";
import { api } from "@/lib/api";
import { DashboardData } from "@/types/analytics.type";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo, useReducer } from "react";

export type PeriodeFilter =
  | "ALL"
  | "TW1"
  | "TW2"
  | "TW3"
  | "TW4"
  | "SM1"
  | "SM2";

interface DashboardFilters {
  year: number;
  kanwilId: string;
  programId: string;
  kancabId: string;
  periode: PeriodeFilter;
  unitType: UnitTypeFilter;
  divisiId: string;
  rankingPage: number;
  rankingUnitId: string;
}

type FilterAction =
  | { type: "SET_YEAR"; value: number }
  | { type: "SET_KANWIL"; value: string }
  | { type: "SET_KANCAB"; value: string }
  | { type: "SET_PROGRAM"; value: string }
  | { type: "SET_PERIODE"; value: PeriodeFilter }
  | { type: "SET_UNIT_TYPE"; value: UnitTypeFilter }
  | { type: "SET_DIVISI"; value: string }
  | { type: "SET_RANKING_PAGE"; value: number }
  | { type: "SET_RANKING_UNIT"; value: string };

const initialFilters: DashboardFilters = {
  year: new Date().getFullYear(),
  kanwilId: "ALL",
  programId: "ALL",
  kancabId: "ALL",
  periode: "ALL",
  unitType: "WILAYAH",
  divisiId: "ALL",
  rankingPage: 1,
  rankingUnitId: "ALL",
};

function filterReducer(
  state: DashboardFilters,
  action: FilterAction,
): DashboardFilters {
  switch (action.type) {
    case "SET_YEAR":
      return { ...state, year: action.value, rankingPage: 1 };

    case "SET_KANWIL":
      // Pilih kanwil → reset kancab, divisi, ranking
      return {
        ...state,
        kanwilId: action.value,
        kancabId: "ALL",
        divisiId: "ALL",
        rankingPage: 1,
      };

    case "SET_KANCAB":
      return { ...state, kancabId: action.value, rankingPage: 1 };

    case "SET_PROGRAM":
      return { ...state, programId: action.value };

    case "SET_PERIODE":
      return { ...state, periode: action.value, rankingPage: 1 };

    case "SET_UNIT_TYPE":
      // Ganti unit type → reset semua wilayah filter
      return {
        ...state,
        unitType: action.value,
        kanwilId: "ALL",
        kancabId: "ALL",
        divisiId: "ALL",
        rankingPage: 1,
      };

    case "SET_DIVISI":
      // Pilih divisi → clear kanwil & kancab (mutually exclusive — AGENTS Rule #5)
      return {
        ...state,
        divisiId: action.value,
        kanwilId: action.value !== "ALL" ? "ALL" : state.kanwilId,
        kancabId: action.value !== "ALL" ? "ALL" : state.kancabId,
        rankingPage: 1,
      };

    case "SET_RANKING_PAGE":
      return { ...state, rankingPage: action.value };

    case "SET_RANKING_UNIT":
      return { ...state, rankingUnitId: action.value };

    default:
      return state;
  }
}

export function useDashboardAnalytics() {
  const [filters, dispatch] = useReducer(filterReducer, initialFilters);

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["dashboard", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("year", String(filters.year));
      params.set("periode", filters.periode);
      params.set("unitType", filters.unitType);

      if (filters.kanwilId !== "ALL") params.set("kanwilId", filters.kanwilId);
      if (filters.programId !== "ALL")
        params.set("programId", filters.programId);
      if (filters.kancabId !== "ALL") params.set("kancabId", filters.kancabId);
      if (filters.unitType === "DIVISI" && filters.divisiId !== "ALL") {
        params.set("divisiId", filters.divisiId);
      }
      params.set("rankingPage", String(filters.rankingPage));
      if (filters.rankingUnitId !== "ALL") {
        params.set("rankingUnitId", filters.rankingUnitId);
      }

      const res = await api.get(`/analytics/dashboard?${params.toString()}`);
      return res.data.data as DashboardData;
    },
  });

  const areaChartData = useMemo(() => {
    const dataBulanan = data?.charts.kegiatanPerBulan;
    if (!dataBulanan) return [];
    switch (filters.periode) {
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
  }, [data, filters.periode]);

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

    // Filter values (baca dari reducer state)
    year: filters.year,
    kanwilId: filters.kanwilId,
    programId: filters.programId,
    kancabId: filters.kancabId,
    periode: filters.periode,
    divisiId: filters.divisiId,
    unitType: filters.unitType,
    rankingPage: filters.rankingPage,
    rankingUnitId: filters.rankingUnitId,

    // Setters → dispatch actions
    setYear: (v: number) => dispatch({ type: "SET_YEAR", value: v }),
    setKanwilId: (v: string) => dispatch({ type: "SET_KANWIL", value: v }),
    setKancabId: (v: string) => dispatch({ type: "SET_KANCAB", value: v }),
    setProgramId: (v: string) => dispatch({ type: "SET_PROGRAM", value: v }),
    setPeriode: (v: PeriodeFilter) =>
      dispatch({ type: "SET_PERIODE", value: v }),
    setUnitType: (v: UnitTypeFilter) =>
      dispatch({ type: "SET_UNIT_TYPE", value: v }),
    setDivisiId: (v: string) => dispatch({ type: "SET_DIVISI", value: v }),
    setRankingPage: (v: number) =>
      dispatch({ type: "SET_RANKING_PAGE", value: v }),
    setRankingUnitId: (v: string) =>
      dispatch({ type: "SET_RANKING_UNIT", value: v }),
  };
}
