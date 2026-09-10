import { api } from "@/lib/api";
import {
  EmployeeManagementQuery,
  EmployeeManagementResponse,
} from "@/types/user.types";
import { useQuery } from "@tanstack/react-query";

const DEFAULT_PAGINATION = {
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
};

export function useEmployeeManagement(query: EmployeeManagementQuery) {
  const { data, isLoading, isFetching, error, refetch } =
    useQuery<EmployeeManagementResponse>({
      queryKey: ["employee-management", query],
      queryFn: () =>
        api
          .get("/employees", {
            params: {
              search: query.search || undefined,
              source: query.source === "ALL" ? undefined : query.source,
              employment:
                query.employment === "ALL" ? undefined : query.employment,
              account: query.account === "ALL" ? undefined : query.account,
              role: query.role === "ALL" ? undefined : query.role,
              page: query.page,
              limit: query.limit,
            },
          })
          .then((response) => response.data),
    });

  return {
    employees: data?.employees ?? [],
    pagination: data?.pagination ?? DEFAULT_PAGINATION,
    isLoading,
    isFetching,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
