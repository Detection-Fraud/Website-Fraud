"use client";

import DataTable, { TableColumn } from "@/components/layout/DataTable";
import { api } from "@/lib/api";
// [UPDATED] Pakai ParticipationRankingResponse yang include categories metadata
import {
  ParticipationRankingItem,
  ParticipationRankingResponse,
} from "@/types/participation.types";
import { Card, Chip, ListBox, Select } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FiAward, FiInbox } from "react-icons/fi";

export default function RankingPartisipasiSection() {
  const [tw, setTw] = useState<string>("ALL");
  const [unitType, setUnitType] = useState<string>("ALL");
  // [UPDATED] pagination state — mirip pola TableCompliance
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // Reset page saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [tw, unitType]);

  // [UPDATED] Query pakai ParticipationRankingResponse — dapat ranking + categories metadata
  const { data } = useQuery<ParticipationRankingResponse>({
    queryKey: ["participation-ranking", tw, unitType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tw !== "ALL") params.append("tw", tw);
      if (unitType !== "ALL") params.append("unitType", unitType);
      const res = await api.get(`/participation/ranking?${params.toString()}`);
      console.log(res.data);
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

  // [UPDATED] Dynamic columns — satu kolom per kategori, sama pola TableCompliance
  const baseColumns: TableColumn[] = [
    { key: "rank", label: "RANK" },
    { key: "unitName", label: "UNIT KERJA" },
    { key: "unitType", label: "TIPE" },
  ];
  const dynamicCategoryColumns: TableColumn[] = categoryMeta.map(
    (cat: any) => ({
      key: `cat_${cat.id}`,
      label: cat.name,
    }),
  );
  const columns: TableColumn[] = [
    ...baseColumns,
    ...dynamicCategoryColumns,
    { key: "averagePercentage", label: "RATA-RATA" },
  ];

  function renderCell(item: ParticipationRankingItem, columnKey: string) {
    if (columnKey === "rank") {
      return (
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
            item.rank === 1
              ? "bg-amber-100 text-amber-800 border border-amber-300"
              : item.rank === 2
                ? "bg-slate-100 text-slate-700 border border-slate-300"
                : item.rank === 3
                  ? "bg-amber-900/10 text-amber-900 border border-amber-900/20"
                  : "text-gray-500 font-medium bg-gray-50"
          }`}
        >
          #{item.rank}
        </span>
      );
    }

    if (columnKey === "unitName") {
      return (
        <div className="min-w-40 max-w-64 whitespace-normal">
          <p className="font-semibold text-slate-800 text-sm">
            {item.unitName}
          </p>
        </div>
      );
    }

    if (columnKey === "unitType") {
      return (
        <span className="text-xs text-gray-500 font-medium">
          {item.unitType}
        </span>
      );
    }

    // [UPDATED] Kolom dinamis per kategori — key format: cat_{categoryId}
    if (columnKey.startsWith("cat_")) {
      const catId = columnKey.replace("cat_", "");
      const catData = item.categories.find((c) => c.categoryId === catId);
      if (!catData) return <span className="text-slate-300 text-xs">-</span>;

      const color =
        catData.percentage >= 80
          ? "success"
          : catData.percentage >= 50
            ? "warning"
            : "danger";

      return (
        <Chip variant="soft" color={color} size="sm">
          {catData.percentage}%
        </Chip>
      );
    }

    if (columnKey === "averagePercentage") {
      if (!item.hasData) {
        return <span className="text-xs italic text-gray-400">-</span>;
      }
      const color =
        (item.averagePercentage ?? 0) >= 80
          ? "success"
          : (item.averagePercentage ?? 0) >= 50
            ? "warning"
            : "danger";
      return (
        <Chip variant="soft" color={color} size="sm">
          {item.averagePercentage}%
        </Chip>
      );
    }

    return null;
  }

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
        <div className="flex items-center gap-2">
          <Select
            aria-label="Filter Tipe Unit"
            className="w-42"
            value={unitType}
            onChange={(key) => setUnitType((key ?? "ALL") as string)}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="ALL" textValue="Semua Unit">
                  <ListBox.ItemIndicator />
                  Semua Unit Kerja
                </ListBox.Item>
                <ListBox.Item id="WILAYAH" textValue="Kanwil">
                  <ListBox.ItemIndicator />
                  Kantor Wilayah
                </ListBox.Item>
                <ListBox.Item id="CABANG" textValue="Kancab">
                  <ListBox.ItemIndicator />
                  Kantor Cabang
                </ListBox.Item>
                <ListBox.Item id="DIVISI" textValue="Divisi">
                  <ListBox.ItemIndicator />
                  Divisi
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            aria-label="Filter Triwulan"
            className="w-32"
            value={tw}
            onChange={(key) => setTw((key ?? "ALL") as string)}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="ALL" textValue="Semua TW">
                  <ListBox.ItemIndicator />
                  Semua TW
                </ListBox.Item>
                <ListBox.Item id="1" textValue="TW I">
                  <ListBox.ItemIndicator />
                  TW I
                </ListBox.Item>
                <ListBox.Item id="2" textValue="TW II">
                  <ListBox.ItemIndicator />
                  TW II
                </ListBox.Item>
                <ListBox.Item id="3" textValue="TW III">
                  <ListBox.ItemIndicator />
                  TW III
                </ListBox.Item>
                <ListBox.Item id="4" textValue="TW IV">
                  <ListBox.ItemIndicator />
                  TW IV
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </Card.Header>

      {/* [UPDATED] DataTable dengan dynamic columns + pagination + custom empty state */}
      <Card.Content className="p-0">
        <DataTable
          column={columns}
          data={paginatedRankings}
          ariaLabel="Tabel ranking partisipasi"
          renderCell={renderCell}
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
