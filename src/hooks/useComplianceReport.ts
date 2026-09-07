import { api } from "@/lib/api";
import {
  ComplianceFilterOptions,
  ComplianceResponse,
  QuarterFilter,
  TabUnitType,
} from "@/types/compliance.types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { useWilayahFilter } from "./useWilayahFilter";

export function useComplianceReport() {
  const { user } = useCurrentUser();
  const wilayah = useWilayahFilter();

  const [activeTab, setActiveTab] = useState<TabUnitType>("NASIONAL");
  const [programId, setProgramId] = useState("ALL");
  const [year, setYear] = useState(new Date().getFullYear());
  const [tw, setTw] = useState<QuarterFilter>("ALL");

  const handleTabChange = (v: TabUnitType) => {
    setActiveTab(v);
    wilayah.resetWilayah();
  };

  useEffect(() => {
    if (user?.role === "PIC" && activeTab === "NASIONAL") {
      if (user.unitType === "KANTOR_WILAYAH") {
        handleTabChange("KANWIL_AND_KANCAB");
      } else if (user.unitType === "KANTOR_CABANG") {
        handleTabChange("KANCAB");
      } else if (user.unitType === "DIVISI") {
        handleTabChange("DIVISI");
      }
    }
  }, [user?.role, user?.unitType, activeTab]);

  const { data: options, isLoading: isLoadingOptions } =
    useQuery<ComplianceFilterOptions>({
      queryKey: ["compliance-options"],
      queryFn: () => api.get("/reports/filter-options").then((res) => res.data),
      staleTime: 5 * 60 * 1000,
    });

  const effectiveKanwilId =
    user?.role === "PIC" && user?.unitType === "KANTOR_WILAYAH"
      ? user.unitId
      : wilayah.kanwilId;

  const kancabList = useMemo(() => {
    if (effectiveKanwilId === "ALL" || !wilayah.kanwilList) return [];
    const selectedKanwil = wilayah.kanwilList.find(
      (k: any) => k.id === effectiveKanwilId,
    );
    return selectedKanwil?.children ?? [];
  }, [effectiveKanwilId, wilayah.kanwilList]);

  const {
    data: complianceData,
    isLoading: isLoadingData,
    error,
    refetch,
  } = useQuery<ComplianceResponse>({
    queryKey: [
      "compliance-data",
      activeTab,
      programId,
      wilayah.kanwilId,
      wilayah.kancabId,
      wilayah.divisiId,
      year,
      tw,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== "NASIONAL") params.append("unitType", activeTab);
      if (programId !== "ALL") params.append("programId", programId);
      if (wilayah.kanwilId !== "ALL")
        params.append("kanwilId", wilayah.kanwilId);
      if (wilayah.kancabId !== "ALL")
        params.append("kancabId", wilayah.kancabId);
      if (wilayah.divisiId !== "ALL")
        params.append("divisiId", wilayah.divisiId);
      params.append("year", String(year));
      if (tw !== "ALL") params.append("tw", tw);

      const res = await api.get(`/reports/compliance?${params.toString()}`);
      return res.data as ComplianceResponse;
    },
  });

  return {
    ...wilayah,
    activeTab,
    programId,
    year,
    tw,
    handleTabChange,
    handleProgramChange: setProgramId,
    handleYearChange: setYear,
    handleTwChange: setTw,

    options: {
      kanwilList: options?.kanwilList ?? [],
      divisiList: options?.divisiList ?? [],
      programList: options?.programList ?? [],
      kancabList: kancabList,
      yearList: options?.yearList ?? [],
    },

    data: complianceData ?? null,
    isLoading: isLoadingOptions || isLoadingData || wilayah.isLoadingMaster,
    isLoadingKancab: wilayah.isLoadingMaster,
    error: error ? (error as Error).message : null,

    refetch,
  };
}
