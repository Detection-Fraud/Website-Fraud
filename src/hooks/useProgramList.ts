import { api } from "@/lib/api";
import { ProgramBudaya } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";

interface ProgramListPayload {
  data: ProgramBudaya[];
}

export function useProgramList(categoryId?: string) {
  const { data, isLoading, error } = useQuery<ProgramListPayload>({
    queryKey: ["program-list", categoryId || "ALL"],
    queryFn: () => {
      const params: Record<string, any> = { limit: 100 };
      if (categoryId && categoryId !== "ALL") params.categoryId = categoryId;
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
