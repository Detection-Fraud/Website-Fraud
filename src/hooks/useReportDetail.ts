"use client";

import { useCurrentUser } from "./useCurrentUser";

import { api } from "@/lib/api";
import { ActivityReportItem } from "@/types/report.types";
import { useQuery } from "@tanstack/react-query";

export function useReportDetail(id: string) {
  const { user } = useCurrentUser();

  const { data: report, isLoading: loading } = useQuery({
    queryKey: ["report-detail", id],
    queryFn: async () => {
      const res = await api.get(`/reports/${id}`);
      return res.data as ActivityReportItem;
    },
    enabled: !!id,
    // Toast error saat query gagal
    meta: { showToast: true },
  });

  return { report: report ?? null, loading, user };
}
