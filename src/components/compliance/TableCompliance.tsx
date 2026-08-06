import DataTable, { TableColumn } from "@/components/layout/DataTable";
import {
  ComplianceResponse,
  UnitComplianceRow,
} from "@/types/compliance.types";
import { Card, Chip, ProgressBar } from "@heroui/react";
import { useEffect, useState } from "react";
import { FaCrown } from "react-icons/fa";
import { TbReportAnalytics } from "react-icons/tb";

interface TableComplianceProps {
  data?: ComplianceResponse | null;
  isLoading?: boolean;
  selectedProgramId: string;
}

export default function TableCompliance({
  data,
  isLoading,
  selectedProgramId,
}: TableComplianceProps) {
  const baseColumn: TableColumn[] = [
    { key: "rank", label: "Rank" },
    { key: "unit", label: "Nama Unit" },
    { key: "wilayah", label: "Wilayah" },
  ];

  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    setPage(1);
  }, [selectedProgramId]);

  const filteredPrograms =
    selectedProgramId === "ALL"
      ? data?.programs
      : data?.programs.filter((p) => p.id === selectedProgramId);

  const dynamicProgramColumns: TableColumn[] =
    filteredPrograms?.map((prog) => ({
      key: `prog_${prog.id}`,
      label: prog.name,
    })) || [];

  const columns: TableColumn[] = [
    ...baseColumn,
    ...dynamicProgramColumns,
    { key: "avg", label: "Rata-Rata" },
  ];

  const renderCell = (item: UnitComplianceRow, columnKey: string) => {
    if (columnKey === "rank") {
      const isTop3 = item.rank <= 3 && item.avg > 0;
      return (
        <div className="flex items-center gap-2 tabular-nums font-semibold">
          {isTop3 && (
            <FaCrown
              className={
                item.rank === 1
                  ? "text-yellow-400"
                  : item.rank === 2
                    ? "text-slate-400"
                    : "text-amber-600"
              }
            />
          )}
          <span
            className={isTop3 ? "font-bold text-slate-800" : "text-slate-600"}
          >
            #{item.rank}
          </span>
        </div>
      );
    }
    if (columnKey === "unit") {
      return (
        <div className="min-w-56 max-w-72 whitespace-normal wrap-break-word">
          <p className="font-semibold text-slate-800">{item.unit.name}</p>
          <p className="text-xs text-slate-400">{item.unit.type}</p>
        </div>
      );
    }
    if (columnKey === "wilayah") {
      return (
        <div className="min-w-48 max-w-64 whitespace-normal wrap-break-word">
          <span className="text-sm text-slate-600 ">{item.unit.wilayah}</span>
        </div>
      );
    }
    if (columnKey === "avg") {
      const avg = item.avg;
      const color = avg >= 50 ? "success" : avg >= 25 ? "warning" : "danger";
      return (
        <Chip variant="soft" color={color} size="sm" className="tabular-nums font-bold">
          {avg}%
        </Chip>
      );
    }
    if (columnKey.startsWith("prog_")) {
      const actualProgramId = columnKey.replace("prog_", "");
      const progData = item.programCompliance.find(
        (p) => p.programId === actualProgramId,
      );
      if (!progData) return <span className="text-slate-300">-</span>;
      
      const pctColor =
        progData.pct >= 100
          ? "success"
          : progData.pct >= 50
            ? "warning"
            : "danger";
      const textColor =
        progData.pct >= 100
          ? "text-emerald-600"
          : progData.pct >= 50
            ? "text-amber-600"
            : "text-rose-600";

      if (selectedProgramId !== "ALL") {
        return (
          <div className="min-w-30 tabular-nums">
            <ProgressBar value={progData.pct} color={pctColor} size="md">
              <ProgressBar.Output />
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
        );
      }
      
      return (
        <div className="flex flex-col w-40 tabular-nums">
          <span className={`font-bold text-sm ${textColor}`}>
            {progData.pct}%
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {progData.submitted} / {progData.target}
          </span>
        </div>
      );
    }

    return null;
  };

  const rawTableData = data?.tableData || [];
  const total = rawTableData.length;
  const totalPages = Math.ceil(total / limit);
  const paginatedData = rawTableData.slice((page - 1) * limit, page * limit);

  return (
    <div>
      <Card className="rounded-2xl p-0 bg-white border border-slate-200/60 shadow-surface">
        <Card.Header className="px-6 py-5 flex flex-row items-start gap-4 border-b border-slate-100">
          <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-700 shrink-0 ring-1 ring-sky-200/50">
            <TbReportAnalytics className="w-5 h-5" />
          </div>
          <div>
            <Card.Title className="font-bold text-slate-900 text-base">
              Compliance Program
            </Card.Title>
            <Card.Description className="text-xs text-slate-400 mt-0.5">
              {data?.cards.totalUnit} unit diurutkan berdasarkan avg compliance
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content className="p-0">
          <DataTable
            column={columns}
            data={paginatedData}
            renderCell={renderCell}
            pagination={{
              total,
              page,
              limit,
              totalPages,
            }}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </Card.Content>
      </Card>
    </div>
  );
}

