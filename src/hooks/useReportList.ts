import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ActivityReportItem, SummaryStats } from "@/types/report.types";
import { useUrlParams } from "./useUrlParams";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface ReportListResponse {
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

  // === PERUBAHAN: regionId/branchId → kanwilId/kancabId ===
  const kanwilFilter = getParam("kanwilId") || "ALL";
  const kancabFilter = getParam("kancabId") || "ALL";

  const filters = {
    page,
    limit,
    search,
    status: statusFilter,
    programId: programFilter,
    kanwilId: kanwilFilter,
    kancabId: kancabFilter,
  };

  const { data, isLoading, error, refetch } = useQuery<ReportListResponse>({
    queryKey: ["reports", filters],
    queryFn: () =>
      api
        .get("/reports", {
          params: {
            page,
            limit,
            search,
            status: statusFilter,
            programId: programFilter,
            kanwilId: kanwilFilter,
            kancabId: kancabFilter,
          },
        })
        .then((res) => res.data),
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
    kanwilFilter,
    kancabFilter,
    programFilter,
    refetch,
  };
}
