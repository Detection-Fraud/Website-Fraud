"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable from "@/components/layout/DataTable";
import { useReportList } from "@/hooks/useReportList";
import {
  Card,
  SearchField,
  SearchFieldGroup,
  Tag,
  TagGroup,
} from "@heroui/react";

import { useProgramList } from "@/hooks/useProgramList";
import { useMasterWilayah } from "@/hooks/useMasterWilayah";

import FilterProgram from "@/components/ui/FilterProgram";
import SelectWilayah from "@/components/ui/SelectWilayah";
import SelectKancab from "@/components/ui/SelectKancab";
import ApprovalSummaryCards from "./ApprovalSummaryCard"; // Pastikan namanya sesuai dengan file kamu

import { REPORT_COLUMNS, renderReportCell } from "@/constants/table.constants";

export default function ApprovalView() {
  const {
    reports,
    pagination,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    updateParams,
    router,
    statusFilter,
    regionFilter,
    branchFilter,
    programFilter,
    summary,
  } = useReportList();

  const { programs } = useProgramList();
  const { regions } = useMasterWilayah();

  const selectedRegion = regions.find((r) => r.id === regionFilter);
  const branches = selectedRegion ? selectedRegion.branches : [];

  return (
    <div className="space-y-8 mb-10">
      <AppBar
        title="Admin Approval"
        description="Daftar foto kegiatan yang telah diupload oleh Kanwil, Kancab, dan Divisi"
        showAddButton={false}
      />

      {/* FILTER SECTION */}
      <div className="flex flex-row gap-2 justify-start items-center">
        <FilterProgram
          value={programFilter}
          onChange={(val) => updateParams({ programId: val, page: "1" })}
        />

        <SelectWilayah
          regions={regions}
          value={regionFilter}
          onChange={(val) =>
            updateParams({ regionId: val, branchId: "ALL", page: "1" })
          }
        />

        <SelectKancab
          branches={branches}
          value={branchFilter}
          isDisabled={regionFilter === "ALL" || !selectedRegion}
          onChange={(val) => updateParams({ branchId: val, page: "1" })}
        />
      </div>

      {/* SUMMARY CARDS SECTION */}
      <ApprovalSummaryCards summary={summary} />

      {/* DATA TABLE SECTION */}
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
