import { api } from "@/lib/api";
import { ProgramBudaya, ProgramCategory, ProgramUnit } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";

export type ProgramWithCategory = ProgramBudaya & {
  category?: ProgramCategory | null;
};
interface ProgramListPayload {
  data: ProgramWithCategory[];
}
export type ProgramListFilter = {
  categoryId?: string;
  purpose?: "EVIDENCE";
  targetUnit?: ProgramUnit;
};

export function useProgramList(filters?: string | ProgramListFilter) {
  const queryParams =
    typeof filters === "string" ? { categoryId: filters } : filters || {};
  const { data, isLoading, error } = useQuery<ProgramListPayload>({
    queryKey: ["program-list", queryParams],
    queryFn: () => {
      const params = { limit: 100, ...queryParams };
      if (params.categoryId === "ALL") delete params.categoryId;
      return api.get("/programs", { params }).then((res) => res.data);
    },
    staleTime: 30 * 1000,
  });

  return {
    programs: data?.data ?? ([] as ProgramBudaya[]),
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
