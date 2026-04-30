"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface ActivityReportItem {
  id: string;
  activityName: string;
  tanggalKegiatan: string;
  lokasi: string;
  picKegiatan: string;
  description: string;
  status: string;
  createdAt: string;
  notes?: string | null;
  region?: { name: string } | null;
  branch?: { name: string } | null;
  division?: { name: string } | null;
  program?: { name: string } | null;
  photos?: { id: number; originalName: string; imageUrl: string }[];
  updatedAt?: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SummaryStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
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

  // Baca state dari URL
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";

  // State lokal untuk search input (biar ga fetch setiap ketik)
  const [searchInput, setSearchInput] = useState(search);

  // Helper untuk update URL search params
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

  // Handler: trigger search dan reset ke page 1
  const handleSearch = () => {
    updateParams({ search: searchInput, page: "1" });
  };

  // Handler: clear search
  const handleClearSearch = () => {
    setSearchInput("");
    updateParams({ search: "", page: "1" });
  };

  // Fetch data setiap kali page/limit/search berubah
  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/reports?page=${page}&limit=${limit}&search=${search}`,
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
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [page, limit, search]);

  // Sync searchInput saat URL berubah (misal user klik Back)
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  return {
    // Data
    reports,
    pagination,
    isLoading,
    error,

    // Search
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,

    // Pagination / URL
    updateParams,

    summary,
    // Navigation
    router,
  };
}
