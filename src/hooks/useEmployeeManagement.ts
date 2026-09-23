import { api } from "@/lib/api";
import {
  EmployeeManagementQuery,
  EmployeeManagementResponse,
} from "@/types/user.types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const DEFAULT_PAGINATION = {
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
};

export function useEmployeeManagement(query: EmployeeManagementQuery) {
  const params = buildEmployeeManagementParams(query);
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } =
    useQuery<EmployeeManagementResponse>({
      queryKey: ["employee-management", params],
      queryFn: () =>
        api
          .get("/employees", { params })
          .then((response) => response.data),
      placeholderData: keepPreviousData,
    });

  return {
    employees: data?.employees ?? [],
    pagination: data?.pagination ?? DEFAULT_PAGINATION,
    isLoading,
    isFetching,
    isPlaceholderData,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

export function buildEmployeeManagementParams(query: EmployeeManagementQuery) {
  const search = query.search.trim();

  return {
    ...(search ? { search } : {}),
    ...(query.source !== "ALL" ? { source: query.source } : {}),
    ...(query.employment !== "ALL"
      ? { employment: query.employment }
      : {}),
    ...(query.account !== "ALL" ? { account: query.account } : {}),
    ...(query.role !== "ALL" ? { role: query.role } : {}),
    page: query.page,
    limit: query.limit,
  };
}
