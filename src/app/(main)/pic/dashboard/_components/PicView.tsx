"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable, { TableColumn } from "@/components/layout/DataTable";
import {
  Button,
  Card,
  Chip,
  SearchField,
  SearchFieldGroup,
  TagGroup,
  Tag,
} from "@heroui/react";
import { FaEye } from "react-icons/fa";

import { ListBox, Select } from "@heroui/react";
import { useSearchParams } from "next/navigation";

import { useProgram } from "@/hooks/useProgram";
import { useReportList } from "@/hooks/useReportList";
import { ActivityReportItem } from "@/types/report.types";
import { REPORT_COLUMNS, renderReportCell } from "@/constants/table.constants";
import FilterStatus from "@/components/ui/FilterStatus";
import FilterProgram from "@/components/ui/FilterProgram";
import SelectKancab from "@/components/ui/SelectKancab";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useMasterWilayah } from "@/hooks/useMasterWilayah";
import { useProgramList } from "@/hooks/useProgramList";

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

  const { data: session } = useSession();
  const user = session?.user;
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
        <Card.Header>
          <Card.Title>Filter</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-row gap-4">
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
              <SearchField>
                <SearchFieldGroup className="shadow-sm bg-[#f8fafc]">
                  <SearchField.SearchIcon />
                  <SearchField.Input
                    placeholder="Search..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch?.()}
                  />
                  <SearchField.ClearButton
                    onClick={() => handleClearSearch?.()}
                  />
                </SearchFieldGroup>
              </SearchField>
            </div>

            <div>
              <TagGroup
                selectedKeys={new Set([statusFilter])}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  updateParams({ status: selected, page: "1" });
                }}
                aria-label="Filter"
                selectionMode="single"
              >
                <TagGroup.List>
                  <Tag
                    id="ALL"
                    className="data-[selected=true]:bg-sky-500 data-[selected=true]:text-white px-3 py-1"
                  >
                    Semua
                  </Tag>
                  <Tag
                    id="PENDING"
                    className="data-[selected=true]:bg-amber-500 data-[selected=true]:text-white px-3 py-1"
                  >
                    Pending
                  </Tag>
                  <Tag
                    id="APPROVED"
                    className="data-[selected=true]:bg-green-500 data-[selected=true]:text-white px-3 py-1"
                  >
                    Approved
                  </Tag>
                  <Tag
                    id="REJECTED"
                    className="data-[selected=true]:bg-red-500 data-[selected=true]:text-white px-3 py-1"
                  >
                    Rejected
                  </Tag>
                </TagGroup.List>
              </TagGroup>
            </div>
          </div>
        </div>

        <DataTable
          column={REPORT_COLUMNS}
          renderCell={(item, key) =>
            renderReportCell(item, key, (id) =>
              router.push(`/admin/approval/${id}`),
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
