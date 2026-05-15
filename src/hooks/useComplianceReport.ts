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
  // --- 1. STATE FILTER REGION, BRANCH, DIVISION AND PROGRAM ---
  const [regionId, setRegionId] = useState<string>("ALL");
  const [branchId, setBranchId] = useState<string>("ALL");
  const [divisionId, setDivisionId] = useState<string>("ALL");
  const [programId, setProgramId] = useState<string>("ALL");

  const [activeTab, setActiveTab] = useState<TabUnitType>("NASIONAL");

  //   --- 2. STATE FOR FILTER VALUES FROM API ---
  const [options, setOptions] = useState<ComplianceFilterOptions>({
    regionsList: [],
    divisionList: [],
    programList: [],
  });

  // --- 3. STATE FOR BRANCH LIST AND DATA FROM FILTER ---
  const [branchList, setBranchList] = useState<FilterOption[]>([]);
  const [data, setData] = useState<ComplianceResponse | null>(null);

  //  --- 4. FOR LOADING STATE & ERROR STATE ---
  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  //   --- 5. FETCH OPTION DATA FROM API ---
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

  // --- 6. FETCH BRANCH LIST BASED ON REGION ATAU USER REGION ID ---
  useEffect(() => {
    async function fetchBranches() {
      // Jika Admin dan belum milih region, jangan fetch
      // Jika PIC Kanwil, regionId dari user otomatis dipakai
      const effectiveRegionId = user?.role === "PIC" && user?.regionId ? user.regionId : regionId;

      if (effectiveRegionId === "ALL" || !effectiveRegionId) {
        setBranchList([]);
        return;
      }
      try {
        setIsLoadingBranches(true);
        const res = await fetch(
          `/api/reports/filter-options/kancab?regionId=${effectiveRegionId}`,
        );
        const json = await res.json();
        if (!json.error && json.data) {
          setBranchList(json.data);
        } else {
          setError(json.message || "Gagal memuat daftar cabang");
        }
      } catch (error) {
        console.error("GAGAL MEMUAT KANCAB!: ", error);
        setError("Error saat memuat data cabang");
      } finally {
        setIsLoadingBranches(false);
      }
    }
    fetchBranches();
  }, [regionId, user?.role, user?.regionId]);

  //   --- 7. FETCH COMPLIANCE DATA ---

  const fetchComplianceData = useCallback(async () => {
    try {
      setIsLoadingData(true);
      setError(null);

      const params = new URLSearchParams();
      if (activeTab !== "NASIONAL") params.append("unitType", activeTab);
      if (programId !== "ALL") params.append("programId", programId);
      if (regionId !== "ALL") params.append("regionId", regionId);
      if (branchId !== "ALL") params.append("branchId", branchId);
      if (divisionId !== "ALL") params.append("divisionId", divisionId);

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
  }, [programId, regionId, branchId, divisionId, activeTab]);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  //   --- 8. RESET FILTER WHEN USER CLEAR THE FILTER
  const handleRegionChange = (newRegionId: string) => {
    setRegionId(newRegionId);
    setBranchId("ALL");
    setDivisionId("ALL");
  };

  const handleBranchChange = (newBranchId: string) => {
    setBranchId(newBranchId);
    setDivisionId("ALL");
  };

  const handleDivisionChange = (newDivisionId: string) => {
    setDivisionId(newDivisionId);
    setRegionId("ALL");
    setBranchId("ALL");
  };

  const handleProgramChange = (newProgramId: string) => {
    setProgramId(newProgramId);
  };

  const handleTabChange = (newTab: TabUnitType) => {
    setActiveTab(newTab);
    setRegionId("ALL");
    setBranchId("ALL");
    setDivisionId("ALL");
  };

  return {
    // STATE FILTER ACTIVE
    activeTab,
    handleTabChange,
    filters: {
      regionId,
      branchId,
      divisionId,
      programId,
    },
    // OPSI FOR DROPDOWN
    options: {
      ...options,
      branchList,
    },
    // DATA COMPLIANCE
    data,
    // STATUS
    isLoading: isLoadingOptions || isLoadingData,
    isLoadingBranches,
    error,
    // HANDLERS
    handleRegionChange,
    handleBranchChange,
    handleDivisionChange,
    handleProgramChange,
    // REFETCH TRIGGER
    refetch: fetchComplianceData,
  };
}
