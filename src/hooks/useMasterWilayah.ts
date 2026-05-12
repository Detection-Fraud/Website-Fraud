import { useEffect, useState } from "react";

export function useMasterWilayah() {
  const [regions, setRegions] = useState<any[]>([]);
  const [isLoadingWilayah, setIsLoading] = useState(true);

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
        setIsLoading(false);
      }
    };
    fetchWilayah();
  }, []);

  return {
    regions,
    isLoadingWilayah,
  };
}
