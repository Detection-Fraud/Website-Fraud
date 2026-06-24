import { api } from "@/lib/api";
import { DivisiOption, RegionWithBranches } from "@/types/region.types";
import { useQuery } from "@tanstack/react-query";

interface MasterWilayahData {
  kanwilList: RegionWithBranches[];
  divisiList: DivisiOption[];
}
export function useMasterWilayah() {
  const { data, isLoading: isLoadingWilayah } = useQuery<MasterWilayahData>({
    queryKey: ["master-wilayah"],
    queryFn: async () => {
      const [wilayahRes, divisiRes] = await Promise.all([
        api.get("/units", { params: { type: "KANTOR_WILAYAH" } }),
        api.get("/units", { params: { type: "DIVISI" } }),
      ]);
      return {
        kanwilList: wilayahRes.data.data ?? [],
        divisiList: divisiRes.data.data ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
  });
  return {
    kanwilList: data?.kanwilList ?? [],
    divisiList: data?.divisiList ?? [],
    isLoadingWilayah,
  };
}
