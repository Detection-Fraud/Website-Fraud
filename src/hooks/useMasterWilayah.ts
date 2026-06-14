import { DivisiOption, RegionWithBranches } from "@/types/region.types";
import { useEffect, useState } from "react";

export function useMasterWilayah() {
  const [kanwilList, setKanwilList] = useState<RegionWithBranches[]>([]);
  const [divisiList, setDivisiList] = useState<DivisiOption[]>([]);
  const [isLoadingWilayah, setIsLoadingWilayah] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [wilayahRes, divisiRes] = await Promise.all([
          fetch(`/api/units?type=KANTOR_WILAYAH`),
          fetch(`/api/units?type=DIVISI`),
        ]);
        const [wilayahJson, divisiJson] = await Promise.all([
          wilayahRes.json(),
          divisiRes.json(),
        ]);
        if (!wilayahRes.ok || !divisiRes.ok) {
          throw new Error("Failed to fetch wilayah/divisi");
        }
        setKanwilList(wilayahJson.data);
        setDivisiList(divisiJson.data ?? []);
      } catch (error) {
        console.error("Gagal memuat data wilayah/divisi", error);
      } finally {
        setIsLoadingWilayah(false);
      }
    };
    fetchAll();
  }, []);
  return {
    kanwilList,
    divisiList,
    isLoadingWilayah,
  };
}
