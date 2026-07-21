"use client";

import { api } from "@/lib/api";
import { PaginationMeta, UserWithUnit } from "@/types/user.types";
import { useQuery } from "@tanstack/react-query";

interface UseManagementUsersOptions {
  unitId: string;
  search?: string;
  page?: number;
  limit?: number;
}
interface UsersResponse {
  users: UserWithUnit[];
  pagination: PaginationMeta;
}

export function useManagementUsers({
  unitId,
  search = "",
  page = 1,
  limit = 10,
}: UseManagementUsersOptions) {
  const { data, isLoading, error, refetch } = useQuery<UsersResponse>({
    queryKey: ["management-users", unitId, search, page, limit],
    queryFn: () =>
      api
        .get("/users", {
          params: { unitId, search, page: String(page), limit: String(limit) },
        })
        .then((res) => res.data),
    enabled: !!unitId && unitId !== "ALL",
  });

  return {
    users: data?.users ?? [],
    pagination: data?.pagination ?? {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    },
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
