import { api } from "@/lib/api";
import { ProgramBudaya } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";

interface ProgramListPayload {
  data: ProgramBudaya[];
}

export function useProgramList() {
  const { data, isLoading, error } = useQuery<ProgramListPayload>({
    queryKey: ["program-list"],
    queryFn: () =>
      api.get("/programs", { params: { limit: 100 } }).then((res) => res.data),
    staleTime: 2 * 60 * 1000,
  });

  return {
    programs: data?.data ?? ([] as ProgramBudaya[]),
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
