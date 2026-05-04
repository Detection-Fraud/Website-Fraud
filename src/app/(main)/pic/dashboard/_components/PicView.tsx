"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable, { TableColumn } from "@/components/layout/DataTable";
import { Button, Chip } from "@heroui/react";
import { FaEye } from "react-icons/fa";

import { ListBox, Select } from "@heroui/react";
import { useSearchParams } from "next/navigation";

import { useProgram } from "@/hooks/useProgram";
import { useReportList } from "@/hooks/useReportList";
import { ActivityReportItem } from "@/types/report.types";
import { REPORT_COLUMNS, renderReportCell } from "@/constants/table.constants";
import FilterStatus from "@/components/ui/FilterStatus";
import FilterProgram from "@/components/ui/FilterProgram";

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
  } = useReportList();

  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") || "ALL";
  const currentProgram = searchParams.get("programId") || "ALL";

  const { programs } = useProgram();

  return (
    <div className="space-y-8 mb-10">
      <AppBar
        onAdd={() => {
          router.push("/pic/detection");
        }}
      />

      <DataTable
        column={REPORT_COLUMNS}
        renderCell={(item, key) =>
          renderReportCell(item, key, (id) =>
            router.push(`/pic/detection/${id}`),
          )
        }
        data={reports}
        pagination={pagination}
        onPageChange={(page) => updateParams({ page: String(page) })}
        search={searchInput}
        onSearch={setSearchInput}
        onClearSearch={handleClearSearch}
        handleSearch={handleSearch}
        filterStatus={
          <FilterStatus
            value={currentStatus}
            onChange={(val) => updateParams({ status: val, page: "1" })}
          />
        }
        filterProgram={
          <FilterProgram
            value={currentProgram}
            onChange={(val) => updateParams({ programId: val, page: "1" })}
          />
        }
      />
    </div>
  );
}
