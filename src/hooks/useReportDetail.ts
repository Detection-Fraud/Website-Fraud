"use client";

import { useEffect, useState } from "react";
import { toast } from "@heroui/react";
import { useCurrentUser } from "./useCurrentUser";

import { ActivityReportItem } from "@/types/report.types";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useReportDetail(id: string) {
  const { user } = useCurrentUser();

  const { data: report, isLoading: loading } = useQuery({
    queryKey: ["report-detail", id],
    queryFn: async () => {
      const res = await api.get(`/reports/${id}`);
      // Backend mengembalikan { error, message, data }
      if (res.data.error) {
        throw new Error(res.data.message || "Gagal memuat data");
      }
      return res.data.data as ActivityReportItem;
    },
    enabled: !!id,
    // Toast error saat query gagal
    meta: { showToast: true },
  });

  return { report: report ?? null, loading, user };
}
