"use client";

import { api } from "@/lib/api";
import type { ParticipationReportQuery } from "@/schemas/participation-report.schema";
import type { ParticipationReportResponse } from "@/types/participation-report.types";
import { useQuery } from "@tanstack/react-query";

export function useParticipationReport(filters: ParticipationReportQuery) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== "ALL",
    ),
  );
  const query = useQuery<ParticipationReportResponse>({
    queryKey: ["participation-reports", filters],
    queryFn: () =>
      api
        .get("/reports/participation", { params })
        .then((response) => response.data),
    enabled:
      filters.participationType === "WITH_EVIDENCE" ||
      filters.participationType === "VALUE_ONLY",
    staleTime: 30_000,
  });
  return {
    rows: query.data?.data ?? [],
    pagination: query.data?.pagination ?? {
      page: filters.page,
      limit: filters.limit,
      total: 0,
      totalPages: 0,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
