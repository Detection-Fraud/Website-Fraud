import { api } from "@/lib/api";
import { ProgramCategory } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";

export function useProgramCategoryQuery() {
  return useQuery<ProgramCategory[]>({
    queryKey: ["program-categories"],
    queryFn: async () => {
      const res = await api.get("/programs/categories");
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 5, // Cache 5 menit
  });
}
