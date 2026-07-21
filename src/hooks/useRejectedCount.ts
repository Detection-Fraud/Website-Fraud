import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useRejectedCount(role?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["rejected-count"],
    queryFn: () => api.get("/reports/rejected-count").then((res) => res.data),
    enabled: role === "PIC",
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });

  return {
    rejectedCount: data?.count ?? 0,
    isLoading,
  };
}
