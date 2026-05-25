import { RegionWithBranches } from "@/types/region.types";
import { useEffect, useState } from "react";

export function useMasterWilayah() {
  const [kanwilList, setKanwilList] = useState<RegionWithBranches[]>([]);
  const [isLoadingWilayah, setIsLoadingWilayah] = useState(true);

  useEffect(() => {
    const fetchWilayah = async () => {
      try {
        const res = await fetch("/api/units?type=KANTOR_WILAYAH");
        const json = await res.json();
        if (!res.ok) {
          throw new Error("Failed to fetch wilayah");
        }
        setKanwilList(json.data);
      } catch (error) {
        console.error("Gagal memuat data wilayah", error);
      } finally {
        setIsLoadingWilayah(false);
      }
    };
    fetchWilayah();
  }, []);
  return {
    kanwilList,
    isLoadingWilayah,
  };
}
