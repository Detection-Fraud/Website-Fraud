"use client";

import { PaginationMeta, UserWithUnit } from "@/types/user.types";
import { useCallback, useEffect, useState } from "react";

interface UseManagementUsersOptions {
  unitId: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useManagementUsers({
  unitId,
  search = "",
  page = 1,
  limit = 10,
}: UseManagementUsersOptions) {
  const [users, setUsers] = useState<UserWithUnit[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!unitId || unitId === "ALL") {
      setUsers([]);
      setPagination({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        unitId,
        search,

        page: String(page),
        limit: String(limit),
      });

      const res = await fetch(`/api/users?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Gagal mengambil data user");
      }

      setUsers(json.data.users ?? []);
      setPagination(json.data.pagination);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  }, [unitId, search, page, limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    pagination,
    isLoading,
    error,
    refetch: fetchUsers,
  };
}
