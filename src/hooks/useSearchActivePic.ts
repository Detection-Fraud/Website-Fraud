import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDebounce } from "use-debounce";

export interface ActivePicResult {
  id: string;
  name: string;
  username: string | null;
  unitId: string | null;
  unit: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export function useSearchActivePic() {
  const [query, setQuery] = useState("");
  const [debounceQuery] = useDebounce(query, 500);
  const [selectedPic, setSelectedPic] = useState<ActivePicResult | null>(null);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["search-active-pic", debounceQuery],
    queryFn: async () => {
      const res = await api.get("/users/search", {
        params: { q: debounceQuery.trim(), role: "PIC" },
      });
      return (res.data ?? []) as ActivePicResult[];
    },
    enabled: debounceQuery.trim().length >= 2,
  });

  const clearSelected = () => {
    setSelectedPic(null);
    setQuery("");
  };

  return {
    query,
    results,
    isLoading,
    selectedPic,
    setQuery,
    setSelectedPic,
    clearSelected,
  };
}
