import {
  ComplianceFilterOptions,
  ComplianceResponse,
  FilterOption,
  TabUnitType,
} from "@/types/compliance.types";
import { useCallback, useEffect, useReducer, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ComplianceFilters {
  kanwilId: string;
  kancabId: string;
  divisiId: string;
  programId: string;
  activeTab: TabUnitType;
  year: number;
}

type FilterAction =
  | { type: "SET_KANWIL"; value: string }
  | { type: "SET_KANCAB"; value: string }
  | { type: "SET_DIVISI"; value: string }
  | { type: "SET_PROGRAM"; value: string }
  | { type: "SET_TAB"; value: TabUnitType }
  | { type: "SET_YEAR"; value: number };

const initialFilters: ComplianceFilters = {
  kanwilId: "ALL",
  kancabId: "ALL",
  divisiId: "ALL",
  programId: "ALL",
  activeTab: "NASIONAL",
  year: new Date().getFullYear(),
};

function filterReducer(
  state: ComplianceFilters,
  action: FilterAction,
): ComplianceFilters {
  switch (action.type) {
    case "SET_KANWIL":
      // Kanwil berubah → reset kancab, clear divisi (mutually exclusive — AGENTS Rule #5)
      return {
        ...state,
        kanwilId: action.value,
        kancabId: "ALL",
        divisiId: "ALL",
      };

    case "SET_KANCAB":
      return { ...state, kancabId: action.value, divisiId: "ALL" };

    case "SET_DIVISI":
      // Divisi berubah → clear kanwil & kancab (mutually exclusive — AGENTS Rule #5)
      return {
        ...state,
        divisiId: action.value,
        kanwilId: "ALL",
        kancabId: "ALL",
      };

    case "SET_PROGRAM":
      return { ...state, programId: action.value };

    case "SET_TAB":
      // Tab berubah → reset semua filter
      return {
        ...state,
        activeTab: action.value,
        kanwilId: "ALL",
        kancabId: "ALL",
        divisiId: "ALL",
      };
    case "SET_YEAR":
      return { ...state, year: action.value };

    default:
      return state;
  }
}
export function useComplianceReport() {
  const { user } = useCurrentUser();

  const [filters, dispatch] = useReducer(filterReducer, initialFilters);

  useEffect(() => {
    if (user?.role === "PIC" && filters.activeTab === "NASIONAL") {
      if (user.unitType === "KANTOR_WILAYAH") {
        dispatch({ type: "SET_TAB", value: "KANWIL_AND_KANCAB" });
      } else if (user.unitType === "KANTOR_CABANG") {
        dispatch({ type: "SET_TAB", value: "KANCAB" });
      } else if (user.unitType === "DIVISI") {
        dispatch({ type: "SET_TAB", value: "DIVISI" });
      }
    }
  }, [user?.role, user?.unitType]);

  const { data: options, isLoading: isLoadingOptions } =
    useQuery<ComplianceFilterOptions>({
      queryKey: ["compliance-options"],
      queryFn: () =>
        api.get("/reports/filter-options").then((res) => res.data.data),
      staleTime: 5 * 60 * 1000,
    });

  const effectiveKanwilId =
    user?.role === "PIC" && user?.unitType === "KANTOR_WILAYAH"
      ? user.unitId
      : filters.kanwilId;

  const { data: kancabList = [], isLoading: isLoadingKancab } = useQuery<
    FilterOption[]
  >({
    queryKey: ["kancab-list", effectiveKanwilId],
    queryFn: () =>
      api
        .get("/reports/filter-options/kancab", {
          params: { kanwilId: effectiveKanwilId },
        })
        .then((res) => res.data.data ?? []),

    enabled: !!effectiveKanwilId && effectiveKanwilId !== "ALL",
  });

  const {
    data: complianceData,
    isLoading: isLoadingData,
    error,
  } = useQuery<ComplianceResponse>({
    queryKey: ["compliance-data", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.activeTab !== "NASIONAL")
        params.append("unitType", filters.activeTab);
      if (filters.programId !== "ALL")
        params.append("programId", filters.programId);
      if (filters.kanwilId !== "ALL")
        params.append("kanwilId", filters.kanwilId);
      if (filters.kancabId !== "ALL")
        params.append("kancabId", filters.kancabId);
      if (filters.divisiId !== "ALL")
        params.append("divisiId", filters.divisiId);

      params.append("year", String(filters.year));

      const res = await api.get(`/reports/compliance?${params.toString()}`);
      return res.data.data as ComplianceResponse;
    },
  });

  return {
    activeTab: filters.activeTab,
    handleTabChange: (v: TabUnitType) =>
      dispatch({ type: "SET_TAB", value: v }),

    filters: {
      kanwilId: filters.kanwilId,
      kancabId: filters.kancabId,
      divisiId: filters.divisiId,
      programId: filters.programId,
      year: filters.year,
    },

    options: {
      kanwilList: options?.kanwilList ?? [],
      divisiList: options?.divisiList ?? [],
      programList: options?.programList ?? [],
      kancabList: kancabList,
    },

    data: complianceData ?? null,
    isLoading: isLoadingOptions || isLoadingData,
    isLoadingKancab,
    error: error ? (error as Error).message : null,

    handleKanwilChange: (v: string) =>
      dispatch({ type: "SET_KANWIL", value: v }),
    handleKancabChange: (v: string) =>
      dispatch({ type: "SET_KANCAB", value: v }),
    handleDivisiChange: (v: string) =>
      dispatch({ type: "SET_DIVISI", value: v }),
    handleProgramChange: (v: string) =>
      dispatch({ type: "SET_PROGRAM", value: v }),
    handleYearChange: (v: number) => dispatch({ type: "SET_YEAR", value: v }),

    refetch: () => {},
  };
}
