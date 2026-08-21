"use client";

import DataTable from "@/components/layout/DataTable";
import { api } from "@/lib/api";
import { ParticipationRankingResponse } from "@/types/participation.types";
import { Card } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FiAward, FiInbox } from "react-icons/fi";
import { RankingPartisipasiFilters } from "./ranking/RankingPartisipasiFilter";
import {
  buildPartisipasiColumns,
  renderPartisipasiCell,
} from "./ranking/ranking-partisipasi-columns";

export default function RankingPartisipasiSection() {
  const [tw, setTw] = useState<string>("ALL");
  const [unitType, setUnitType] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // Reset page saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [tw, unitType]);

  const { data } = useQuery<ParticipationRankingResponse>({
    queryKey: ["participation-ranking", tw, unitType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tw !== "ALL") params.append("tw", tw);
      if (unitType !== "ALL") params.append("unitType", unitType);
      const res = await api.get(`/participation/ranking?${params.toString()}`);
      return res.data ?? { ranking: [], categories: [], total: 0 };
    },
    staleTime: 5 * 60 * 1000,
  });

  const allRankings = (data?.ranking ?? []).filter((r: any) => r.hasData);
  const categoryMeta = data?.categories ?? [];

  // Pagination
  const total = allRankings.length;
  const totalPages = Math.ceil(total / LIMIT);
  const paginatedRankings = allRankings.slice((page - 1) * LIMIT, page * LIMIT);
  const columns = buildPartisipasiColumns(categoryMeta);

  return (
    <Card className="rounded-lg p-0">
      <Card.Header className="px-4 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center shrink-0">
            <FiAward size={20} />
          </div>
          <div>
            <Card.Title className="font-bold text-slate-800 text-md">
              Ranking Partisipasi Budaya
            </Card.Title>
            <Card.Description className="text-xs text-slate-500">
              {total} unit diurutkan berdasarkan rata-rata partisipasi
            </Card.Description>
          </div>
        </div>

        {/* FILTERS */}
        <RankingPartisipasiFilters
          unitType={unitType}
          onUnitTypeChange={setUnitType}
          tw={tw}
          onTwChange={setTw}
        />
      </Card.Header>

      {/* [UPDATED] DataTable dengan dynamic columns + pagination + custom empty state */}
      <Card.Content className="p-0">
        <DataTable
          column={columns}
          data={paginatedRankings}
          ariaLabel="Tabel ranking partisipasi"
          renderCell={renderPartisipasiCell}
          pagination={{ total, page, limit: LIMIT, totalPages }}
          onPageChange={setPage}
          renderEmptyState={() => (
            <div className="w-full py-12 px-4 text-center flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 bg-slate-100/80 border border-slate-200/60 rounded-2xl flex items-center justify-center text-slate-400 shadow-xs">
                <FiInbox size={24} />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Belum Ada Data Partisipasi
              </p>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Data partisipasi untuk filter yang dipilih belum diimport atau
                tidak ditemukan.
              </p>
            </div>
          )}
        />
      </Card.Content>
    </Card>
  );
}
