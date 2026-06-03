"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable from "@/components/layout/DataTable";
import { useReportList } from "@/hooks/useReportList";
import {
  Card
} from "@heroui/react";

import { useMasterWilayah } from "@/hooks/useMasterWilayah";

import FilterProgram from "@/components/ui/FilterProgram";
import SelectKancab from "@/components/ui/SelectKancab";
import SelectWilayah from "@/components/ui/SelectWilayah";

import ReportSearchBar from "@/components/ui/ReportSearchBar";
import StatusTagGroup from "@/components/ui/StatusTagGroup";
import SummaryCards from "@/components/ui/SummaryCard";
import { REPORT_COLUMNS, renderReportCell } from "@/constants/table.constants";
import { BsCheck2Circle, BsXCircle } from "react-icons/bs";
import { FiAlertTriangle, FiImage } from "react-icons/fi";

export default function ApprovalView() {
  const {
    reports,
    pagination,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    updateParams,
    kanwilFilter,
    kancabFilter,
    router,
    statusFilter,
    programFilter,
    summary,
  } = useReportList();

  const summaryCards = [
    {
      title: "Total Upload",
      value: summary.total,
      description: "Semua Unggahan",
      icon: FiImage,
      style: "text-blue-600 bg-blue-100",
      textColor: "text-[#0284c7]",
    },
    {
      title: "Menunggu",
      value: summary.pending,
      description: "Total Menunggu",
      icon: FiAlertTriangle,
      style: "bg-orange-100 text-orange-600",
      textColor: "text-[#d97706]",
    },
    {
      title: "Disetujui",
      value: summary.approved,
      icon: BsCheck2Circle,
      description: "Total Disetujui",
      style: "bg-green-100 text-green-600",
      textColor: "text-[#059669]",
    },
    {
      title: "Ditolak",
      value: summary.rejected,
      icon: BsXCircle,
      description: "Total Ditolak",
      style: "bg-red-100 text-red-600",
      textColor: "text-[#dc2626]",
    },
  ];

  const { kanwilList } = useMasterWilayah();

  const selectedKanwil = kanwilList.find((k) => k.id === kanwilFilter);
  const kancabList = selectedKanwil ? selectedKanwil.children : [];

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
          regions={kanwilList}
          value={kanwilFilter}
          className="w-70"
          onChange={(val) =>
            updateParams({ kanwilId: val, kancabId: "ALL", page: "1" })
          }
        />

        <SelectKancab
          branches={kancabList}
          value={kancabFilter}
          isDisabled={kanwilFilter === "ALL" || !selectedKanwil}
          onChange={(val) => updateParams({ kancabId: val, page: "1" })}
        />
      </div>

      {/* SUMMARY CARDS SECTION */}
      <SummaryCards summary={summaryCards} />

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
