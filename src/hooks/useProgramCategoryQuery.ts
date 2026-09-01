import { api } from "@/lib/api";
import { ProgramCategory } from "@generated/prisma";
import { useQuery } from "@tanstack/react-query";
import { CategoryFilter } from "./useCategoryList";

type TargetUnit = "KEGIATAN" | "PARTISIPASI_PERSEN";

export function useProgramCategoryQuery(
  targetUnit?: TargetUnit,
): ReturnType<typeof useQuery<ProgramCategory[]>>;
export function useProgramCategoryQuery(
  filters?: CategoryFilter,
): ReturnType<typeof useQuery<ProgramCategory[]>>;

export function useProgramCategoryQuery(
  input: CategoryFilter | TargetUnit = { targetUnit: "KEGIATAN" },
) {
  const filters: CategoryFilter =
    typeof input === "string" ? { targetUnit: input } : input;
  const params = new URLSearchParams();
  if (filters.targetUnit) params.set("targetUnit", filters.targetUnit);
  if (filters.evidenceMode) params.set("evidenceMode", filters.evidenceMode);
  if (filters.scoreInputMode)
    params.set("scoreInputMode", filters.scoreInputMode);
  return useQuery<ProgramCategory[]>({
    queryKey: ["program-categories", filters],
    queryFn: async () =>
      (await api.get(`/programs/categories?${params}`)).data ?? [],
    staleTime: 30 * 1000,
  });
}
