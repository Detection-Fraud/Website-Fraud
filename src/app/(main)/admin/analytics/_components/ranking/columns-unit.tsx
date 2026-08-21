import { TableColumn } from "@/components/layout/DataTable";
import { RankingWilayah } from "@/types/analytics.type";
import { Chip } from "@heroui/react";
import { BsCheckCircle } from "react-icons/bs";
import { FaMedal, FaTrophy } from "react-icons/fa";

export const unitRankingColumns: TableColumn[] = [
  { key: "rank", label: "RANK" },
  { key: "name", label: "WILAYAH" },
  { key: "kegiatan", label: "KEGIATAN" },
  { key: "disetujui", label: "DISETUJUI" },
  { key: "approvalRate", label: "APPROVAL RATE" },
  { key: "status", label: "STATUS" },
];

export function renderUnitRankingCell(item: RankingWilayah, columnKey: string) {
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
      return <span className="font-semibold text-slate-900">{item.name}</span>;

    case "kegiatan":
      return <span className="font-bold text-slate-900">{item.kegiatan}</span>;

    case "disetujui":
      return (
        <div className="flex items-center gap-2 text-green-600">
          <BsCheckCircle className="w-4 h-4" />
          <span>{item.disetujui}</span>
        </div>
      );

    case "approvalRate":
      const barColor =
        item.approvalRate >= 90
          ? "bg-green-500"
          : item.approvalRate >= 80
            ? "bg-blue-500"
            : item.approvalRate >= 70
              ? "bg-orange-500"
              : "bg-red-500";
      return (
        <div className="flex items-center gap-3">
          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${item.approvalRate}%` }}
            />
          </div>
          <span className="font-bold text-slate-900">{item.approvalRate}%</span>
        </div>
      );

    case "status": {
      const colorTheme =
        item.status === "Sangat Baik"
          ? "success"
          : item.status === "Baik"
            ? "default"
            : item.status === "Cukup"
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
