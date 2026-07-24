import { api } from "@/lib/api";
import { ActivityReportItem, SummaryStats } from "@/types/report.types";
import { useQuery } from "@tanstack/react-query";
import { useUrlParams } from "./useUrlParams";
import { useWilayahFilter } from "./useWilayahFilter";

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface ReportListPayload {
  data: ActivityReportItem[];
  pagination: PaginationInfo;
  summary: SummaryStats;
}
export function useReportList() {
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
  const limit = Number(getParam("limit") || "6");
  const search = getParam("search") || "";

  const statusFilter = getParam("status") || "ALL";
  const programFilter = getParam("programId") || "ALL";
  const initialKanwilId = getParam("kanwilId") || "ALL";
  const initialKancabId = getParam("kancabId") || "ALL";
  const initialDivisiId = getParam("divisiId") || "ALL";

  const wilayah = useWilayahFilter({
    kanwilId: initialKanwilId,
    kancabId: initialKancabId,
    divisiId: initialDivisiId,
  });

  const filters = {
    page,
    limit,
    search,
    status: statusFilter,
    programId: programFilter,
    kanwilId: wilayah.kanwilId,
    kancabId: wilayah.kancabId,
    divisiId: wilayah.divisiId,
  };

  const { data, isLoading, error, refetch } = useQuery<ReportListPayload>({
    queryKey: ["reports", filters],
    queryFn: () => api.get("/reports", { params: filters }).then((res) => res.data),
  });

  return {
    reports: data?.data ?? [],
    pagination: data?.pagination ?? {
      total: 0,
      page: 1,
      limit: 6,
      totalPages: 0,
    },
    summary: data?.summary ?? {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    },
    isLoading,
    error: error ? (error as Error).message : null,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    updateParams,
    statusFilter,
    router,
    ...wilayah,
    programFilter,
    refetch,
  };
}
