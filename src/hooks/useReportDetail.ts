"use client";

import { useEffect, useState } from "react";
import { toast } from "@heroui/react";
import { useCurrentUser } from "./useCurrentUser";

import { ActivityReportItem } from "@/types/report.types";

export function useReportDetail(id: string) {
  const [report, setReport] = useState<ActivityReportItem | null>(null);
  const [loading, setLoading] = useState(true);

  const { user } = useCurrentUser();

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/reports/${id}`);
        const result = await response.json();

        // Di lib/response.ts, jika gagal maka `error: true`
        if (result.error || !response.ok) {
          // Hanya lempar 1 string message
          toast.danger(result.message || "Gagal memuat data");
          return;
        }

        setReport(result.data);
      } catch (err: any) {
        toast.danger("Terjadi kesalahan jaringan");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchReport();
    }
  }, [id]);

  return { report, loading, user };
}
