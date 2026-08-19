import { api } from "@/lib/api";
import { ProgramBudaya, ProgramCategory } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";
import { useUrlParams } from "./useUrlParams";

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

export type ProgramBudayaWithCategory = ProgramBudaya & {
  category: ProgramCategory | null;
};

interface ProgramListPayload {
  data: ProgramBudayaWithCategory[];
  summary: ProgramSummary;
  pagination: PaginationData;
}

export function useProgramQuery() {
  const {
    updateParams,
    getParam,
    searchInput,
    handleSearch,
    handleClearSearch,
    setSearchInput,
  } = useUrlParams();

  const page = Number(getParam("page") || "1");
  const limit = Number(getParam("limit") || "10");
  const search = getParam("search") || "";
  const categoryId = getParam("categoryId") || "ALL";
  const tw = getParam("tw") || "ALL";
  const status = getParam("status") || "ALL";

  const { data, isLoading, error } = useQuery<ProgramListPayload>({
    queryKey: ["programs", { page, limit, search, categoryId, tw, status }],
    queryFn: () =>
      api
        .get("/programs", {
          params: {
            page,
            limit,
            search,
            ...(categoryId !== "ALL" && { categoryId }),
            ...(tw !== "ALL" && { tw }),
            ...(status !== "ALL" && { status }),
          },
        })
        .then((res) => res.data),
  });

  const handleFilterCategory = (val: string) => {
    updateParams({ categoryId: val === "ALL" ? "" : val, page: "1" });
  };

  const handleFilterTw = (val: string) => {
    updateParams({ tw: val === "ALL" ? "" : val, page: "1" });
  };

  const handleFilterStatus = (val: string) => {
    updateParams({ status: val === "ALL" ? "" : val, page: "1" });
  };

  const handleResetAllFilters = () => {
    setSearchInput("");
    updateParams({
      search: "",
      categoryId: "",
      tw: "",
      status: "",
      page: "1",
    });
  };

  const hasActiveFilters = Boolean(
    search || categoryId !== "ALL" || tw !== "ALL" || status !== "ALL",
  );
  return {
    // Data
    programs: data?.data ?? [],
    summary: data?.summary ?? { active: 0, inActive: 0, total: 0 },
    pagination: data?.pagination ?? {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    },
    isLoading,
    error: error ? (error as Error).message : null,

    // Filter States
    categoryId,
    tw,
    status,
    hasActiveFilters,

    // Filter Handlers
    handleFilterCategory,
    handleFilterTw,
    handleFilterStatus,
    handleResetAllFilters,

    // Search (dari useUrlParams)
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,

    // URL helper
    updateParams,
  };
}
