"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable from "@/components/layout/DataTable";
import {
  Card,
  SearchField,
  SearchFieldGroup,
  Tag,
  TagGroup,
} from "@heroui/react";

import { ListBox, Select } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import { FiFilter } from "react-icons/fi";

import FilterProgram from "@/components/ui/FilterProgram";
import SelectKancab from "@/components/ui/SelectKancab";
import { REPORT_COLUMNS, renderReportCell } from "@/constants/table.constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMasterWilayah } from "@/hooks/useMasterWilayah";
import { useReportList } from "@/hooks/useReportList";
import { useState } from "react";
import StatusTagGroup from "@/components/ui/StatusTagGroup";
import ReportSearchBar from "@/components/ui/ReportSearchBar";

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
  } = useReportList();

  const { user } = useCurrentUser();
  const isKanwil = user?.unitType === "KANTOR_WILAYAH";

  const [unitLevel, setUnitLevel] = useState<"KANWIL" | "KANCAB">("KANWIL");
  const searchParams = useSearchParams();

  const { kanwilList } = useMasterWilayah();
  const myKanwil = kanwilList.find((k) => k.id === user?.unitId);
  const myKancabList = myKanwil ? myKanwil.children : [];

  const currentProgram = searchParams.get("programId") || "ALL";

  return (
    <div className="space-y-8 mb-10">
      <AppBar
        onAdd={() => {
          router.push("/pic/detection");
        }}
      />

      <Card className="shadow-sm rounded-xl hover:shadow-md transition-shadow">
        <Card.Content className="flex flex-row items-center gap-4">
          <div className="flex items-center gap-2">
            <FiFilter className="size-5 text-gray-500" />
            <p className="text-sm font-medium text-gray-600">Filter :</p>
          </div>
          {isKanwil && (
            <div className="flex items-center gap-4">
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
                className="w-48"
              >
                <Select.Trigger className="shadow-sm bg-white border border-gray-200">
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
                  onChange={(val) => updateParams({ kancabId: val, page: "1" })}
                />
              )}
            </div>
          )}

          <FilterProgram
            value={currentProgram}
            labelOff
            onChange={(key) =>
              updateParams({ programId: String(key), page: "1" })
            }
          />
        </Card.Content>
      </Card>

      <Card className="rounded-lg shadow-md border-gray-200 p-0">
        <div className="flex flex-row w-full items-center justify-between pr-4">
          <Card.Header className="p-4">
            <Card.Title className="font-semibold text-md">
              Daftar Laporan
            </Card.Title>
            <Card.Description className="text-xs text-gray-500">
              {summary.total} data
            </Card.Description>
          </Card.Header>

          <div className="flex flex-row items-center justify-center gap-6">
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
          renderCell={(item, key) =>
            renderReportCell(item, key, (id) =>
              router.push(`/pic/approval/${id}`),
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
