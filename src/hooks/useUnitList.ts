"use client";

import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export interface UnitItem {
  id: string;
  name: string;
  type: string;
  _count?: {
    users: number;
  };
}

const TYPE_MAP: Record<string, string> = {
  KANWIL: "KANTOR_WILAYAH",
  KANCAB: "KANTOR_CABANG",
  DIVISI: "DIVISI",
};

export function useUnitList(unitType: string) {
  const dbType = TYPE_MAP[unitType];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["units", unitType],
    queryFn: () =>
      api.get("/units", { params: { type: dbType } }).then((res) => res.data),
    enabled: !!dbType,
  });

  return {
    units: (data ?? []) as UnitItem[],
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
