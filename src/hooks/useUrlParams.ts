"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export function useUrlParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const updateParams = useCallback(
    (newParams: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, searchParams, pathname],
  );

  const getParam = useCallback(
    (key: string, fallback: string = "") => searchParams.get(key) || fallback,
    [searchParams],
  );

  const [searchInput, setSearchInput] = useState(getParam("search"));

  const handleSearch = useCallback(() => {
    updateParams({ search: searchInput, page: "1" });
  }, [searchInput, updateParams]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    updateParams({ search: "", page: "1" });
  }, [updateParams]);

  // Sync searchInput saat URL berubah (user klik back)
  const search = getParam("search");
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setSearchInput(search);
  }
  return {
    updateParams,
    getParam,
    searchParams,
    router,
    pathname,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
  };
}
