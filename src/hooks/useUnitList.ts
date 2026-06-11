"use client";

import { useEffect, useState } from "react";

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
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = () => setTrigger((prev) => prev + 1);

  useEffect(() => {
    const dbType = TYPE_MAP[unitType];

    if (!dbType) {
      setUnits([]);
      return;
    }

    const fetchUnits = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/units?type=${dbType}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message || "Gagal memuat data unit");
        }

        setUnits(json.data ?? []);
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : "Terjadi kesalahan");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnits();
  }, [unitType, trigger]);

  return {
    units,
    isLoading,
    error,
    refetch,
  };
}
