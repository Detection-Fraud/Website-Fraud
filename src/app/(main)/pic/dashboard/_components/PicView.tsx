"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable from "@/components/layout/DataTable";
import { Card, Chip } from "@heroui/react";

import { ListBox, Select } from "@heroui/react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { FiFileText, FiFilter } from "react-icons/fi";

import FilterCategory from "@/components/ui/FilterCategory";
import ReportSearchBar from "@/components/ui/ReportSearchBar";
import SelectKancab from "@/components/ui/SelectKancab";
import StatusTagGroup from "@/components/ui/StatusTagGroup";
import { REPORT_COLUMNS, renderReportCell } from "@/constants/table.constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useReportList } from "@/hooks/useReportList";
import { useEffect, useState } from "react";

export default function PicView() {
  const {
    reports,
    pagination,
    isLoading,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    updateParams,
    router,
    statusFilter,
    summary,
    kanwilList,
    categoryList,
    categoryFilter,
  } = useReportList();

  const { user } = useCurrentUser();
  const isKanwil = user?.unitType === "KANTOR_WILAYAH";

  const searchParams = useSearchParams();
  const kancabIdParam = searchParams.get("kancabId");

  const [unitLevel, setUnitLevel] = useState<"KANWIL" | "KANCAB">(
    kancabIdParam && kancabIdParam !== "ALL" && kancabIdParam !== ""
      ? "KANCAB"
      : "KANWIL",
  );

  useEffect(() => {
    if (kancabIdParam && kancabIdParam !== "ALL" && kancabIdParam !== "") {
      setUnitLevel("KANCAB");
    }
  }, [kancabIdParam]);

  const myKanwil = kanwilList.find((k: any) => k.id === user?.unitId);
  const myKancabList = myKanwil ? myKanwil.children : [];

  return (
    <div className="space-y-6 mb-10">
      <AppBar
        onAdd={() => {
          router.push("/pic/submit");
        }}
        textAddButton="Buat Laporan"
        title="Dashboard Kantor Wilayah"
        description="List laporan bulanan yang telah dikirim"
      />

      {/* UPDATED: Welcome Hero Banner — Full-bleed 3D BG + Left Dark Zone */}
      <Card className="relative overflow-hidden bg-slate-950 text-white rounded-2xl shadow-surface border border-slate-800/80 p-0 min-h-55">
        {/* Full-bleed Background Illustration */}
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="/images/pic-banner-image.png"
            alt="Shield of Integrity Infographic"
            fill
            className="object-contain object-right"
            priority
            unoptimized
          />
          {/* Dark reading zone: covers left 60% with strong gradient fade */}
          <div className="absolute inset-0 bg-linear-to-r from-slate-950 via-slate-950/90 sm:via-slate-950/80 to-transparent w-[70%] sm:w-[65%]" />
          {/* Subtle overall dark veil so right edge has min contrast */}
          <div className="absolute inset-0 bg-slate-950/20" />
        </div>

        {/* Left Content Column — lives inside the dark reading zone */}
        <div className="relative z-10 flex flex-col items-start justify-between gap-5 p-6 md:p-8 max-w-md">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Chip
                color="accent"
                variant="soft"
                size="sm"
                className="text-[10px] uppercase font-bold tracking-wider"
              >
                Culture Catalyst
              </Chip>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              Selamat datang kembali, {user?.name || "Pelapor"}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Unit Kerja:{" "}
              <span className="font-semibold text-white">
                {user?.unitName || "Kantor Wilayah"}
              </span>
            </p>
          </div>

          {/* Stat Pill Badge neatly integrated in Left Column */}
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              <FiFileText className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tabular-nums text-white">
                {summary.total || 0}
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Total Laporan Dilaporkan
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* UPDATED: Filter Card Surface Upgrade */}
      <Card className="shadow-surface hover:shadow-surface-md transition-all duration-200 rounded-2xl border border-slate-200/60 bg-white p-2 md:p-3">
        <Card.Content className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider md:pr-3 md:border-r border-slate-200 shrink-0">
            <FiFilter className="size-4 text-slate-400" />
            <span>Filter</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full">
            {isKanwil && (
              <>
                <Select
                  aria-label="Pilih Unit"
                  placeholder="Pilih Level Unit"
                  value={unitLevel}
                  onChange={(key) => {
                    const val = (key ?? "KANWIL") as "KANWIL" | "KANCAB";
                    setUnitLevel(val);

                    if (val === "KANWIL") {
                      updateParams({ kancabId: "", page: "1" });
                    }
                  }}
                  className="w-full md:w-52"
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="KANWIL" textValue="Kantor Wilayah">
                        Semua Unit
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="KANCAB" textValue="Kantor Cabang">
                        Kantor Cabang
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                {unitLevel === "KANCAB" && (
                  <SelectKancab
                    branches={myKancabList}
                    value={searchParams.get("kancabId") || ""}
                    isDisabled={false}
                    labelOff
                    className="w-full md:w-52"
                    onChange={(val) =>
                      updateParams({ kancabId: val, page: "1" })
                    }
                  />
                )}
              </>
            )}

            <FilterCategory
              value={categoryFilter}
              labelOff
              categories={categoryList}
              className="w-full md:w-52"
              onChange={(key) =>
                updateParams({
                  categoryId: String(key),
                  programId: String(key),
                  page: "1",
                })
              }
            />
          </div>
        </Card.Content>
      </Card>

      {/* UPDATED: Table Card Surface & Token Upgrade */}
      <Card className="rounded-2xl shadow-surface hover:shadow-[var(--surface-shadow-md)] transition-all duration-200 border border-slate-200/60 bg-white p-0 overflow-hidden">
        <div className="flex flex-col md:flex-row w-full items-start md:items-center justify-between gap-3 p-4">
          <Card.Header className="p-4">
            <Card.Title className="font-semibold text-md text-slate-900">
              Daftar Laporan
            </Card.Title>
            <Card.Description className="text-xs text-slate-500 tabular-nums">
              {summary.total} data
            </Card.Description>
          </Card.Header>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div>
              <ReportSearchBar
                value={searchInput}
                onChange={setSearchInput}
                onSearch={handleSearch}
                onClear={handleClearSearch}
              />
            </div>

            <div>
              <StatusTagGroup
                value={statusFilter}
                onChange={(status) => updateParams({ status, page: "1" })}
              />
            </div>
          </div>
        </div>

        <DataTable
          column={REPORT_COLUMNS}
          renderCell={(item: any, key: any) =>
            renderReportCell(item, key, (id) =>
              router.push(`/pic/submit/${id}`),
            )
          }
          data={reports}
          pagination={pagination}
          onPageChange={(page) => updateParams({ page: String(page) })}
        />
      </Card>
    </div>
  );
}
