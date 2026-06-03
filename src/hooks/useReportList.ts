import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ActivityReportItem, SummaryStats } from "@/types/report.types";
import { useUrlParams } from "./useUrlParams";

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useReportList() {
  const [reports, setReports] = useState<ActivityReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [summary, setSummary] = useState<SummaryStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const {
    updateParams,
    getParam,
    router,
    searchInput,
    handleSearch,
    handleClearSearch,
    setSearchInput,
  } = useUrlParams();

  const page = Number(getParam("page") || "1");
  const limit = Number(getParam("limit") || "10");
  const search = getParam("search") || "";

  const statusFilter = getParam("status") || "ALL";
  const programFilter = getParam("programId") || "ALL";

  // === PERUBAHAN: regionId/branchId → kanwilId/kancabId ===
  const kanwilFilter = getParam("kanwilId") || "ALL";
  const kancabFilter = getParam("kancabId") || "ALL";

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        // === PERUBAHAN: regionId/branchId → kanwilId/kancabId ===
        const response = await fetch(
          `/api/reports?page=${page}&limit=${limit}&search=${search}&status=${statusFilter}&programId=${programFilter}&kanwilId=${kanwilFilter}&kancabId=${kancabFilter}`,
        );
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.message || "Gagal mengambil data laporan");
        }
        setReports(json.data || []);
        setPagination(json.pagination);

        if (json.summary) {
          setSummary(json.summary);
        }
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : "Terjadi kesalahan");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [
    page,
    limit,
    search,
    statusFilter,
    programFilter,
    kanwilFilter,
    kancabFilter,
  ]);

  return {
    reports,
    pagination,
    isLoading,
    error,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    updateParams,
    summary,
    statusFilter,
    router,
    kanwilFilter,
    kancabFilter,
    programFilter,
  };
}
