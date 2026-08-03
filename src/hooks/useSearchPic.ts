import { api } from "@/lib/api";
import { PicSearchResult } from "@/types/pic.types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDebounce } from "use-debounce";

interface UseSearchPICOptions {
  unitId?: string;
  role?: string;
}

export function useSearchPic({ unitId, role }: UseSearchPICOptions) {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 500);
  const [selectedUser, setSelectedUser] = useState<PicSearchResult | null>(
    null,
  );

  const {
    data: results = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["search-pic", debouncedQuery, unitId, role],
    queryFn: async () => {
      const params: Record<string, string> = { q: debouncedQuery.trim() };
      if (unitId && unitId !== "ALL") params.unitId = unitId;
      if (role) params.role = role;

      const res = await api.get("/users/search", { params });
      return (res.data ?? []) as PicSearchResult[];
    },
    enabled: debouncedQuery.trim().length >= 2,
  });

  const clearSelected = () => {
    setSelectedUser(null);
    setQuery("");
  };

  const clearQuery = () => {
    setQuery("");
  };

  return {
    query,
    results,
    isLoading,
    error: error ? (error as Error).message : null,
    selectedUser,
    selectedPic: selectedUser,
    setQuery,
    setSelectedUser,
    setSelectedPic: setSelectedUser,
    clearSelected,
    clearQuery,
  };
}
