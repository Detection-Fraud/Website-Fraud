import { api } from "@/lib/api";
import { ProgramCategory } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";

export interface CategoryWithStats extends ProgramCategory {
  totalProgram: number;
  totalActive: number;
}

interface CategoryListPayload {
  success: boolean;
  message: string;
  data: CategoryWithStats[];
}

export function useCategoryList(targetUnit?: "KEGIATAN" | "PARTISIPASI_PERSEN") {
  const { data, isLoading, error, refetch } = useQuery<CategoryListPayload>({
    queryKey: ["categories", targetUnit],
    queryFn: () => {
      const params = targetUnit ? `?targetUnit=${targetUnit}` : "";
      return api.get(`/programs/categories${params}`).then((res) => res.data);
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    categories: data?.data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
