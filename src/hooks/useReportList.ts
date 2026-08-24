import { api } from "@/lib/api";
import { ActivityReportItem, SummaryStats } from "@/types/report.types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCategoryList } from "./useCategoryList";
import { useUrlParams } from "./useUrlParams";
import { useWilayahFilter } from "./useWilayahFilter";

export type ReportStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const REPORT_STATUSES: ReportStatusFilter[] = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
];

const REPORT_SCOPES = [
  "ALL",
  "WILAYAH",
  "WILAYAH_AND_CABANG",
  "CABANG",
  "DIVISI",
] as const;

export type ReportScope = (typeof REPORT_SCOPES)[number];

interface UseReportListOptions {
  defaultStatus?: ReportStatusFilter;
}

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

export function resolveReportStatus(
  status: string,
  defaultStatus: ReportStatusFilter,
): ReportStatusFilter {
  return REPORT_STATUSES.includes(status as ReportStatusFilter)
    ? (status as ReportStatusFilter)
    : defaultStatus;
}

export function resolveReportScope(input: {
  scope?: string;
  kanwilId: string;
  kancabId: string;
  divisiId: string;
}): ReportScope {
  if (REPORT_SCOPES.includes(input.scope as ReportScope)) {
    return input.scope as ReportScope;
  }
  if (input.divisiId !== "ALL") return "DIVISI";
  if (input.kancabId !== "ALL") return "CABANG";
  if (input.kanwilId !== "ALL") return "WILAYAH";
  return "ALL";
}

export function getScopeUpdates(scope: ReportScope) {
  return {
    scope,
    kanwilId: "",
    kancabId: "",
    divisiId: "",
    page: "1",
  };
}

export function getCategoryUpdates(categoryId: string) {
  return {
    categoryId: categoryId === "ALL" ? "" : categoryId,
    programId: "",
    page: "1",
  };
}

export function useReportList({
  defaultStatus = "ALL",
}: UseReportListOptions = {}) {
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
  const statusFilter = resolveReportStatus(getParam("status"), defaultStatus);
  const categoryFilter = getParam("categoryId") || "ALL";
  const programFilter = getParam("programId") || "ALL";
  const kanwilId = getParam("kanwilId") || "ALL";
  const kancabId = getParam("kancabId") || "ALL";
  const divisiId = getParam("divisiId") || "ALL";
  const scopeFilter = resolveReportScope({
    scope: getParam("scope"),
    kanwilId,
    kancabId,
    divisiId,
  });

  const wilayahMaster = useWilayahFilter();
  const { categories: categoryList } = useCategoryList("KEGIATAN");

  const kancabList = useMemo(() => {
    if (kanwilId === "ALL") return [];
    return (
      wilayahMaster.kanwilList.find((item: any) => item.id === kanwilId)
        ?.children ?? []
    );
  }, [kanwilId, wilayahMaster.kanwilList]);

  const filters = {
    page,
    limit,
    search,
    status: statusFilter,
    categoryId: categoryFilter !== "ALL" ? categoryFilter : undefined,
    programId: programFilter !== "ALL" ? programFilter : undefined,
    kanwilId,
    kancabId,
    divisiId,
  };

  const { data, isLoading, error, refetch } = useQuery<ReportListPayload>({
    queryKey: ["reports", filters],
    queryFn: () =>
      api
        .get("/reports", { params: filters })
        .then((response) => response.data),
  });

  const handleStatusChange = (status: string) => {
    updateParams({
      status: resolveReportStatus(status, defaultStatus),
      page: "1",
    });
  };

  const handleCategoryChange = (categoryId: string) => {
    updateParams(getCategoryUpdates(categoryId));
  };

  const handleProgramChange = (programId: string) => {
    updateParams({
      programId: programId === "ALL" ? "" : programId,
      page: "1",
    });
  };

  const handleScopeChange = (scope: ReportScope) => {
    updateParams(getScopeUpdates(scope));
  };

  const handleKanwilChange = (value: string) => {
    updateParams({
      kanwilId: value === "ALL" ? "" : value,
      kancabId: "",
      divisiId: "",
      page: "1",
    });
  };

  const handleKancabChange = (value: string) => {
    updateParams({
      kancabId: value === "ALL" ? "" : value,
      divisiId: "",
      page: "1",
    });
  };

  const handleDivisiChange = (value: string) => {
    updateParams({
      divisiId: value === "ALL" ? "" : value,
      kanwilId: "",
      kancabId: "",
      page: "1",
    });
  };

  const handlePageChange = (nextPage: number) => {
    updateParams({ page: String(nextPage) });
  };

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
    router,
    statusFilter,
    categoryFilter,
    programFilter,
    scopeFilter,
    kanwilId,
    kancabId,
    divisiId,
    kanwilList: wilayahMaster.kanwilList,
    divisiList: wilayahMaster.divisiList,
    kancabList,
    isLoadingMaster: wilayahMaster.isLoadingMaster,
    categoryList,
    refetch,
    handleStatusChange,
    handleCategoryChange,
    handleProgramChange,
    handleScopeChange,
    handleKanwilChange,
    handleKancabChange,
    handleDivisiChange,
    handlePageChange,
  };
}
