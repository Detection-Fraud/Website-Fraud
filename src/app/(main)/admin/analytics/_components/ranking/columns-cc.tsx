import { TableColumn } from "@/components/layout/DataTable";
import { RankingCC } from "@/types/analytics.type";
import { Chip } from "@heroui/react";
import { BsCheckCircle } from "react-icons/bs";
import { FaMedal, FaTrophy } from "react-icons/fa";

export const ccRankingColumns: TableColumn[] = [
  { key: "rank", label: "RANK" },
  { key: "name", label: "NAMA CC" },
  { key: "unitName", label: "UNIT KERJA" },
  { key: "submitted", label: "TOTAL SUBMIT" },
  { key: "approved", label: "DISETUJUI" },
  { key: "target", label: "TARGET" },
  { key: "approvalRate", label: "COMPLIANCE" },
  { key: "status", label: "STATUS" },
];

export function renderCCRankingCell(item: RankingCC, columnKey: string) {
  switch (columnKey) {
    case "rank":
      if (item.rank === 1)
        return <FaTrophy className="text-yellow-500 w-5 h-5" />;
      if (item.rank === 2)
        return <FaMedal className="text-slate-400 w-5 h-5" />;
      if (item.rank === 3)
        return <FaMedal className="text-amber-700 w-5 h-5" />;
      return <span className="text-slate-500 font-medium">#{item.rank}</span>;

    case "name":
      return (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
            {item.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-slate-900">{item.name}</span>
        </div>
      );

    case "unitName":
      return <span className="text-slate-600 text-sm">{item.unitName}</span>;

    case "submitted":
      return <span className="font-bold text-slate-900">{item.submitted}</span>;

    case "approved":
      return (
        <div className="flex items-center gap-2 text-green-600">
          <BsCheckCircle className="w-4 h-4" />
          <span>{item.approved}</span>
        </div>
      );

    case "target":
      return <span className="text-slate-500 text-sm">{item.target}</span>;

    case "approvalRate":
      const barColor =
        item.approvalRate >= 50
          ? "bg-green-500"
          : item.approvalRate >= 25
            ? "bg-orange-500"
            : "bg-red-500";
      return (
        <div className="flex items-center gap-3">
          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.min(item.approvalRate, 100)}%` }}
            />
          </div>
          <span className="font-bold text-slate-900">{item.approvalRate}%</span>
        </div>
      );

    case "status": {
      const colorTheme =
        item.status === "On Track"
          ? "success"
          : item.status === "Behind"
            ? "warning"
            : "danger";
      return (
        <Chip
          color={colorTheme}
          variant="soft"
          size="sm"
          className="font-medium"
        >
          {item.status}
        </Chip>
      );
    }

    default:
      return (item as any)[columnKey];
  }
}
