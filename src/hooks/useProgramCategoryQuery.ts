import { api } from "@/lib/api";
import { ProgramCategory } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";

export function useProgramCategoryQuery(
  targetUnit: "KEGIATAN" | "PARTISIPASI_PERSEN" = "KEGIATAN",
) {
  return useQuery<ProgramCategory[]>({
    queryKey: ["program-categories", targetUnit],
    queryFn: async () => {
      const params = targetUnit ? `?targetUnit=${targetUnit}` : "";
      const res = await api.get(`/programs/categories${params}`);
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 5, // Cache 5 menit
  });
}
