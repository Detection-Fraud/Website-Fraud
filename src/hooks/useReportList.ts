import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ActivityReportItem, SummaryStats } from "@/types/report.types";

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

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";

  const statusFilter = searchParams.get("status") || "ALL";
  const programFilter = searchParams.get("programId") || "ALL";

  // === PERUBAHAN: regionId/branchId → kanwilId/kancabId ===
  const kanwilFilter = searchParams.get("kanwilId") || "ALL";
  const kancabFilter = searchParams.get("kancabId") || "ALL";

  const [searchInput, setSearchInput] = useState(search);

  const updateParams = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearch = () => {
    updateParams({ search: searchInput, page: "1" });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateParams({ search: "", page: "1" });
  };

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
    kanwilFilter, // dulunya regionFilter
    kancabFilter, // dulunya branchFilter
  ]);

  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setSearchInput(search);
  }

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
    kanwilFilter, // dulunya regionFilter
    kancabFilter, // dulunya branchFilter
    programFilter,
  };
}
