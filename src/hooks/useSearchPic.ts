import { PicSearchResult } from "@/types/pic.types";
import { useCallback, useEffect, useState } from "react";

interface UseSearchPICOptions {
  unitId?: string;
}

export function useSearchPic({ unitId }: UseSearchPICOptions) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PicSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<PicSearchResult | null>(
    null,
  );

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({ q: q.trim() });
        if (unitId && unitId !== "ALL") {
          params.set("unitId", unitId);
        }

        const res = await fetch(`/api/users/search?${params}`);
        const json = await res.json();

        if (!res.ok) throw new Error(json.message || "Gagal mencari user");

        setResults(json.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [unitId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  const clearSelected = () => {
    setSelectedUser(null);
    setQuery("");
    setResults([]);
    setError(null);
  };

  const clearQuery = () => {
    setQuery("");
    setResults([]);
  };

  return {
    query,
    results,
    isLoading,
    error,
    selectedUser,

    setQuery,
    setSelectedUser,
    clearSelected,
    clearQuery,
  };
}
