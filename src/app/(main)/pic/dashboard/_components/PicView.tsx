"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable, { TableColumn } from "@/components/layout/DataTable";
import { Button, Card, Chip } from "@heroui/react";
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

      <Card className="p-0 rounded-lg shadow-sm border-slate-400">
        <Card.Content>
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
          />
        </Card.Content>
      </Card>
    </div>
  );
}
