import { Categories, GlobalSummary } from "@/types/categories.types";
import { useEffect, useState } from "react";

export function useCategories() {
  const [categories, setCategories] = useState<Categories[]>([]);
  const [summary, setSummary] = useState<GlobalSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/programs/categories");

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.message || "Gagal mengambil data categories");
        }

        setCategories(json.data || []);
        setSummary(json.summary || null);
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : "Terjadi Kesalahan");
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    summary,
  };
}
