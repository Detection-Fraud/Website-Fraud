import { api } from "@/lib/api";
import type { CategoryWithStats } from "@/types/program-category";
import type { ProgramCategory } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";

export type { CategoryWithStats } from "@/types/program-category";

export type CategoryFilter = Partial<
  Pick<ProgramCategory, "targetUnit" | "evidenceMode" | "scoreInputMode">
>;

type TargetUnit = "KEGIATAN" | "PARTISIPASI_PERSEN";

export function useCategoryList(
  filters?: CategoryFilter,
): ReturnType<typeof useCategoryListImpl>;
export function useCategoryList(
  targetUnit?: TargetUnit,
): ReturnType<typeof useCategoryListImpl>;
export function useCategoryList(input: CategoryFilter | TargetUnit = {}) {
  const filters: CategoryFilter =
    typeof input === "string" ? { targetUnit: input } : input;
  return useCategoryListImpl(filters);
}

function useCategoryListImpl(filters: CategoryFilter) {
  const params = new URLSearchParams();
  if (filters.targetUnit) params.set("targetUnit", filters.targetUnit);
  if (filters.evidenceMode) params.set("evidenceMode", filters.evidenceMode);
  if (filters.scoreInputMode)
    params.set("scoreInputMode", filters.scoreInputMode);
  const query = params.toString();

  const result = useQuery<CategoryWithStats[]>({
    queryKey: ["categories", filters],
    queryFn: () =>
      api
        .get(`/programs/categories${query ? `?${query}` : ""}`)
        .then((res) => res.data),
    staleTime: 30 * 1000,
  });
  return {
    categories: result.data ?? [],
    isLoading: result.isLoading,
    error: result.error ? (result.error as Error).message : null,
    refetch: result.refetch,
  };
}
