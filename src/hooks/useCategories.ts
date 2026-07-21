import { api } from "@/lib/api";
import { Categories, GlobalSummary } from "@/types/categories.types";
import { useQuery } from "@tanstack/react-query";

interface CategoriesResponse {
  data: Categories[];
  summary: GlobalSummary | null;
}
export function useCategories() {
  const {
    data,
    isLoading: loadingCategories,
    error,
  } = useQuery<CategoriesResponse>({
    queryKey: ["categories"],
    queryFn: () => api.get("/programs/categories").then((res) => res.data),
  });

  return {
    categories: data?.data ?? [],
    loadingCategories,
    error: error ? (error as Error).message : null,
    summary: data?.summary ?? null,
  };
}
