"use client";

import DataTable, { TableColumn } from "@/components/layout/DataTable";
import { RankingWilayah } from "@/types/analytics.type";
import { Card, Chip } from "@heroui/react";
import { BsCheckCircle } from "react-icons/bs";
import { FaMedal, FaTrophy } from "react-icons/fa";

interface AnalyticRankingTableProps {
  data?: RankingWilayah[];
}

export default function AnalyticTableRanking({
  data = [],
}: AnalyticRankingTableProps) {
  const columns: TableColumn[] = [
    { key: "rank", label: "RANK" },
    { key: "name", label: "WILAYAH" },
    { key: "unit", label: "UNIT" },
    { key: "kegiatan", label: "KEGIATAN" },
    { key: "disetujui", label: "DISETUJUI" },
    { key: "approvalRate", label: "APPROVAL RATE" },
    { key: "status", label: "STATUS" },
  ];

  const renderCell = (item: RankingWilayah, columnKey: string) => {
    switch (columnKey) {
      case "rank":
        if (item.rank === 1)
          return <FaTrophy className="text-yellow-500 w-5 h-5" />;
        if (item.rank === 2)
          return <FaMedal className="text-gray-400 w-5 h-5" />;
        if (item.rank === 3)
          return <FaMedal className="text-amber-700 w-5 h-5" />;
        return <span className="text-gray-500 font-medium">#{item.rank}</span>;
      case "name":
        return <span className="font-semibold text-gray-900">{item.name}</span>;
      case "unit":
        return <span className="text-gray-500">{item.unit}</span>;
      case "kegiatan":
        return <span className="font-bold text-gray-900">{item.kegiatan}</span>;
      case "disetujui":
        return (
          <div className="flex items-center gap-2 text-green-600">
            <BsCheckCircle className="w-4 h-4" />
            <span>{item.approval}</span>
          </div>
        );
      case "approvalRate":
        return (
          <div className="flex items-center gap-3">
            {/* Progress Bar Mini */}
            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  item.approvalRate >= 90
                    ? "bg-green-500"
                    : item.approvalRate >= 80
                      ? "bg-blue-500"
                      : item.approvalRate >= 70
                        ? "bg-orange-500"
                        : "bg-red-500"
                }`}
                style={{ width: `${item.approvalRate}%` }}
              />
            </div>
            <span className="font-bold text-gray-900">
              {item.approvalRate}%
            </span>
          </div>
        );
      case "status":
        let colorTheme: "success" | "default" | "warning" | "danger" = "danger";
        if (item.status === "Sangat Baik") colorTheme = "success";
        else if (item.status === "Baik") colorTheme = "default";
        else if (item.status === "Cukup") colorTheme = "warning";

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
      default:
        return (item as any)[columnKey];
    }
  };

  return (
    <Card className="p-0">
      <div className="w-full">
        <Card.Header className="p-4">
          <Card.Title className="text-md font-bold">
            Ranking Lengkap Unit Kerja per Wilayah
          </Card.Title>
          <Card.Description className="text-xs font-light">
            Diurutkan berdasarkan tingkat persetujuan tertinggi
          </Card.Description>
        </Card.Header>
      </div>

      <Card.Content>
        <div className="w-full">
          <DataTable column={columns} data={data} renderCell={renderCell} />
        </div>
      </Card.Content>
    </Card>
  );
}
