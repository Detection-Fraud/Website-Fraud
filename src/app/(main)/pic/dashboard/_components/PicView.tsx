"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable from "@/components/layout/DataTable";
import { Card } from "@heroui/react";

import { ListBox, Select } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import { FiFilter } from "react-icons/fi";

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

  const currentProgram = searchParams.get("programId") || "ALL";

  return (
    <div className="space-y-8 mb-10">
      <AppBar
        onAdd={() => {
          router.push("/pic/submit");
        }}
      />

      <Card className="shadow-xs rounded-2xl border border-slate-200/80 bg-white p-2 md:p-3">
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

                    // Jika user memilih kembali ke "Kantor Wilayah", clear parameter kancabId
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

                {/* 2. FILTER PILIH KANCAB (Hanya render jika level == KANCAB) */}
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

      <Card className="rounded-lg shadow-md border-gray-200 p-0">
        <div className="flex flex-col md:flex-row w-full items-start md:items-center justify-between gap-3 p-4">
          <Card.Header className="p-4">
            <Card.Title className="font-semibold text-md">
              Daftar Laporan
            </Card.Title>
            <Card.Description className="text-xs text-gray-500">
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
