"use client";

import { api } from "@/lib/api";
import { DivisiOption, RegionWithBranches } from "@/types/region.types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useReducer } from "react";

export interface WilayahFilterState {
  kanwilId: string;
  kancabId: string;
  divisiId: string;
}

type WilayahAction =
  | { type: "SET_KANWIL"; value: string }
  | { type: "SET_KANCAB"; value: string }
  | { type: "SET_DIVISI"; value: string }
  | { type: "RESET" };

const initialState: WilayahFilterState = {
  kanwilId: "ALL",
  kancabId: "ALL",
  divisiId: "ALL",
};

function wilayahReducer(
  state: WilayahFilterState,
  action: WilayahAction,
): WilayahFilterState {
  switch (action.type) {
    case "SET_KANWIL":
      return {
        kanwilId: action.value,
        kancabId: "ALL",
        divisiId: "ALL",
      };
    case "SET_KANCAB":
      return { ...state, kancabId: action.value, divisiId: "ALL" };
    case "SET_DIVISI":
      return {
        kanwilId: "ALL",
        kancabId: "ALL",
        divisiId: action.value,
      };
    case "RESET":
      return initialState;
    default: {
      return state;
    }
  }
}

export function useWilayahFilter(
  initialOverrides?: Partial<WilayahFilterState>,
) {
  const [state, dispatch] = useReducer(wilayahReducer, {
    ...initialState,
    ...initialOverrides,
  });

  const { data: masterData, isLoading: isLoadingMaster } = useQuery<{
    kanwilList: RegionWithBranches[];
    divisiList: DivisiOption[];
  }>({
    queryKey: ["master-wilayah"],
    queryFn: async () => {
      const [wilayahRes, divisiRes] = await Promise.all([
        api.get("/units", { params: { type: "KANTOR_WILAYAH" } }),
        api.get("/units", { params: { type: "DIVISI" } }),
      ]);
      return {
        kanwilList: wilayahRes.data ?? [],
        divisiList: divisiRes.data ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const kancabList = useMemo(() => {
    if (state.kanwilId === "ALL" || !masterData?.kanwilList) return [];
    const selectedKanwil = masterData.kanwilList.find(
      (k: RegionWithBranches) => k.id === state.kanwilId,
    );
    return selectedKanwil?.children ?? [];
  }, [state.kanwilId, masterData?.kanwilList]);

  return {
    ...state,
    kanwilList: masterData?.kanwilList ?? [],
    divisiList: masterData?.divisiList ?? [],
    kancabList,
    isLoadingMaster,

    // Actions
    setKanwilId: (v: string) => dispatch({ type: "SET_KANWIL", value: v }),
    setKancabId: (v: string) => dispatch({ type: "SET_KANCAB", value: v }),
    setDivisiId: (v: string) => dispatch({ type: "SET_DIVISI", value: v }),
    resetWilayah: () => dispatch({ type: "RESET" }),
  };
}
