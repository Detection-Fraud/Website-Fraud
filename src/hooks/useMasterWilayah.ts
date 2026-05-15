import { RegionWithBranches } from "@/types/region.types";
import { useEffect, useState } from "react";

export function useMasterWilayah() {
  const [regions, setRegions] = useState<RegionWithBranches[]>([]);
  const [isLoadingWilayah, setIsLoadingWilayah] = useState(true);

  useEffect(() => {
    const fetchWilayah = async () => {
      try {
        const res = await fetch("/api/regions");
        const json = await res.json();
        if (!res.ok) {
          throw new Error("Failed to fetch wilayah");
        }
        setRegions(json.data);
      } catch (error) {
        console.log("Error fetching wilayah:", error);
      } finally {
        setIsLoadingWilayah(false);
      }
    };
    fetchWilayah();
  }, []);

  return {
    regions,
    isLoadingWilayah,
  };
}
