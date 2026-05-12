import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { ProgramBudaya } from "@generated/prisma";
import { useOverlayState } from "@heroui/react";

export type ProgramSummary = {
  active: number;
  inActive: number;
  total: number;
};

export type PaginationData = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function useProgram() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // --- BACA STATE DARI URL (source of truth) ---
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";

  // --- STATE DATA ---
  const [programs, setPrograms] = useState<ProgramBudaya[]>([]);
  const [summary, setSummary] = useState<ProgramSummary>({
    active: 0,
    inActive: 0,
    total: 0,
  });
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- REFRESH KEY — trigger re-fetch tanpa reload halaman ---
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshData = () => setRefreshKey((prev) => prev + 1);

  // --- STATE LOKAL UNTUK INPUT SEARCH ---
  // (lokal agar tidak fetch tiap ketik, baru update URL saat handleSearch)
  const [searchInput, setSearchInput] = useState(search);

  // Helper: update URL params tanpa reload halaman
  const updateParams = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
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

  // Sync searchInput saat URL berubah (misal user klik Back)
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Fetch data setiap kali page/limit/search dari URL berubah
  useEffect(() => {
    const fetchPrograms = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/programs?page=${page}&limit=${limit}&search=${search}`,
        );
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.message || "Gagal mengambil data program");
        }

        setPrograms(json.data || []);
        if (json.summary) setSummary(json.summary);
        if (json.pagination) setPagination(json.pagination);
        setError(null);
      } catch (error: any) {
        console.error("Fetch Program Error:", error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrograms();
  }, [page, limit, search, refreshKey]); // refreshKey memaksa fetch ulang tanpa reload

  // --- MODAL & ACTION STATES ---
  const modalState = useOverlayState();
  const [selectedProgram, setSelectedProgram] = useState<ProgramBudaya | null>(
    null,
  );

  const [isActionLoading, setIsActionLoading] = useState(false);

  // --- MODAL ADD & UPDATE STATES ---
  const modalAddState = useOverlayState();

  const handleAddToggleClick = () => {
    setSelectedProgram(null);
    modalAddState.open();
  };

  const handleToggleClick = (program: ProgramBudaya) => {
    setSelectedProgram(program);
    modalState.open();
  };

  const handleEditToggleClick = (program: ProgramBudaya) => {
    setSelectedProgram(program);
    modalAddState.open();
  };

  const handleAddProgram = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      frequency: Number(formData.get("frequency")),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      isActive: true,
    };
    setIsActionLoading(true);
    try {
      const isEdit = !!selectedProgram;
      const url = isEdit ? `/api/programs/${selectedProgram!.id}` : `/api/programs`;
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok)
        throw new Error(
          `Gagal ${isEdit ? "mengubah" : "menambah"} program budaya!`,
        );

      modalAddState.close();
      refreshData();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan pada server");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!selectedProgram) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/programs/${selectedProgram.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !selectedProgram.isActive }),
      });
      if (!res.ok) throw new Error("Gagal mengubah status program");
      modalState.close();
      refreshData(); // hanya re-fetch data, bukan reload seluruh halaman
    } catch (error: any) {
      setError(error.message || "Terjadi kesalahan pada server");
    } finally {
      setIsActionLoading(false);
    }
  };

  return {
    // Data
    programs,
    isLoading,
    error,
    summary,
    pagination,

    // Search
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,

    // URL helper
    updateParams,

    // Modal & Actions
    modalState,
    selectedProgram,
    isActionLoading,
    handleToggleClick,
    handleConfirmToggle,

    // Modal add & update
    modalAddState,
    handleAddToggleClick,
    handleAddProgram,

    handleEditToggleClick,
  };
}
