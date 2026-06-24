import { useDebounce } from "use-debounce";
import { api } from "@/lib/api";
import { PicSearchResult } from "@/types/pic.types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface UseSearchPICOptions {
  unitId?: string;
}

export function useSearchPic({ unitId }: UseSearchPICOptions) {
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
    queryKey: ["search-pic", debouncedQuery, unitId],
    queryFn: async () => {
      const params: Record<string, string> = { q: debouncedQuery.trim() };
      if (unitId && unitId !== "ALL") params.unitId = unitId;

      const res = await api.get("/users/search", { params });
      return (res.data.data ?? []) as PicSearchResult[];
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
    setQuery,
    setSelectedUser,
    clearSelected,
    clearQuery,
  };
}
