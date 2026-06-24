import { api } from "@/lib/api";
import { ProgramBudaya } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";

interface ProgramListResponse {
  data: ProgramBudaya[];
}

export function useProgramList() {
  const { data, isLoading, error } = useQuery<ProgramListResponse>({
    queryKey: ["program-list"],
    queryFn: () =>
      api.get("/programs", { params: { limit: 10 } }).then((res) => res.data),
    staleTime: 2 * 60 * 1000,
  });

  return {
    programs: data?.data ?? ([] as ProgramBudaya[]),
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
