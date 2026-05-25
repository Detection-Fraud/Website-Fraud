import {
  ComplianceFilterOptions,
  ComplianceResponse,
  FilterOption,
  TabUnitType,
} from "@/types/compliance.types";
import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";

export function useComplianceReport() {
  const { user } = useCurrentUser();

  // === PERUBAHAN: regionId/branchId/divisionId → kanwilId/kancabId/divisiId ===
  const [kanwilId, setKanwilId] = useState<string>("ALL");
  const [kancabId, setKancabId] = useState<string>("ALL");
  const [divisiId, setDivisiId] = useState<string>("ALL");
  const [programId, setProgramId] = useState<string>("ALL");

  const [activeTab, setActiveTab] = useState<TabUnitType>("NASIONAL");

  useEffect(() => {
    if (user?.role === "PIC" && activeTab === "NASIONAL") {
      if (user.unitType === "KANTOR_WILAYAH") {
        setActiveTab("KANWIL_AND_KANCAB");
      } else if (user.unitType === "KANTOR_CABANG") {
        setActiveTab("KANCAB");
      } else if (user.unitType === "DIVISI") {
        setActiveTab("DIVISI")
      }
    }
  }, [user?.role, user?.unitType, activeTab]);
  const [options, setOptions] = useState<ComplianceFilterOptions>({
    kanwilList: [], // dulunya regionsList
    divisiList: [], // dulunya divisionList
    kancabList: [],
    programList: [],
  });

  const [kancabList, setKancabList] = useState<FilterOption[]>([]);
  const [data, setData] = useState<ComplianceResponse | null>(null);

  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(false);
  const [isLoadingKancab, setIsLoadingKancab] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInitialOptions() {
      try {
        setIsLoadingOptions(true);
        const res = await fetch("/api/reports/filter-options");
        const json = await res.json();
        if (!json.error && json.data) {
          setOptions(json.data);
        } else {
          setError(json.message || "Gagal memuat opsi filter");
        }
      } catch (e) {
        console.error(e);
        setError("Error saat memuat data");
      } finally {
        setIsLoadingOptions(false);
      }
    }
    fetchInitialOptions();
  }, []);

  // === PERUBAHAN: fetch kancab berdasarkan kanwilId (parentId) ===
  useEffect(() => {
    async function fetchKancab() {
      const effectiveKanwilId =
        user?.role === "PIC" && user?.unitType === "KANTOR_WILAYAH"
          ? user.unitId
          : kanwilId;

      if (effectiveKanwilId === "ALL" || !effectiveKanwilId) {
        setKancabList([]);
        return;
      }
      try {
        setIsLoadingKancab(true);
        const res = await fetch(
          `/api/reports/filter-options/kancab?kanwilId=${effectiveKanwilId}`,
        );
        const json = await res.json();
        if (!json.error && json.data) {
          setKancabList(json.data);
        } else {
          setError(json.message || "Gagal memuat daftar cabang");
        }
      } catch (error) {
        console.error("GAGAL MEMUAT KANCAB!: ", error);
        setError("Error saat memuat data cabang");
      } finally {
        setIsLoadingKancab(false);
      }
    }
    fetchKancab();
  }, [kanwilId, user?.role, user?.unitId, user?.unitType]);

  const fetchComplianceData = useCallback(async () => {
    try {
      setIsLoadingData(true);
      setError(null);

      const params = new URLSearchParams();
      if (activeTab !== "NASIONAL") params.append("unitType", activeTab);
      if (programId !== "ALL") params.append("programId", programId);
      if (kanwilId !== "ALL") params.append("kanwilId", kanwilId);
      if (kancabId !== "ALL") params.append("kancabId", kancabId);
      if (divisiId !== "ALL") params.append("divisiId", divisiId);

      const res = await fetch(`/api/reports/compliance?${params.toString()}`);
      const json = await res.json();

      if (res.ok) {
        setData(json.data);
      } else {
        setError(json.message || "Gagal memuat data compliance");
      }
    } catch (error) {
      setError(
        String(error) || "Gagal memuat data laporan compliance di catch",
      );
    } finally {
      setIsLoadingData(false);
    }
  }, [programId, kanwilId, kancabId, divisiId, activeTab]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchComplianceData();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchComplianceData]);

  // === PERUBAHAN: Cascading filter — Kanwil/Kancab mutually exclusive dengan Divisi ===
  const handleKanwilChange = (newKanwilId: string) => {
    setKanwilId(newKanwilId);
    setKancabId("ALL");
    setDivisiId("ALL");
  };

  const handleKancabChange = (newKancabId: string) => {
    setKancabId(newKancabId);
    setDivisiId("ALL");
  };

  const handleDivisiChange = (newDivisiId: string) => {
    setDivisiId(newDivisiId);
    setKanwilId("ALL");
    setKancabId("ALL");
  };

  const handleProgramChange = (newProgramId: string) => {
    setProgramId(newProgramId);
  };

  const handleTabChange = (newTab: TabUnitType) => {
    setActiveTab(newTab);
    setKanwilId("ALL");
    setKancabId("ALL");
    setDivisiId("ALL");
  };

  return {
    activeTab,
    handleTabChange,
    filters: {
      kanwilId, // dulunya regionId
      kancabId, // dulunya branchId
      divisiId, // dulunya divisionId
      programId,
    },
    options: {
      ...options,
      kancabList, // dulunya branchList
    },
    data,
    isLoading: isLoadingOptions || isLoadingData,
    isLoadingKancab, // dulunya isLoadingBranches
    error,
    handleKanwilChange, // dulunya handleRegionChange
    handleKancabChange, // dulunya handleBranchChange
    handleDivisiChange, // dulunya handleDivisionChange
    handleProgramChange,
    refetch: fetchComplianceData,
  };
}
