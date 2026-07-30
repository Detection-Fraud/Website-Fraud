"use client";

import DataTable, { TableColumn } from "@/components/layout/DataTable";
import { RankingCC, RankingWilayah } from "@/types/analytics.type";
import { PaginationInfo } from "@/types/report.types";
import { Card, Chip, Tabs } from "@heroui/react";
import { useState } from "react";
import { BsCheckCircle } from "react-icons/bs";
import { FaMedal, FaTrophy } from "react-icons/fa";

interface AnalyticRankingTableProps {
  data?: RankingWilayah[];
  ccData?: RankingCC[];
  pagination?: PaginationInfo;
  ccPagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
  onCCPageChange?: (page: number) => void;
}

type RankingTab = "unit" | "cc";

export default function AnalyticTableRanking({
  data = [],
  ccData = [],
  pagination,
  ccPagination,
  onPageChange,
  onCCPageChange,
}: AnalyticRankingTableProps) {
  const [activeTab, setActiveTab] = useState<RankingTab>("unit");
  const unitColumns: TableColumn[] = [
    { key: "rank", label: "RANK" },
    { key: "name", label: "WILAYAH" },
    { key: "kegiatan", label: "KEGIATAN" },
    { key: "disetujui", label: "DISETUJUI" },
    { key: "approvalRate", label: "APPROVAL RATE" },
    { key: "status", label: "STATUS" },
  ];

  const ccColumns: TableColumn[] = [
    { key: "rank", label: "RANK" },
    { key: "name", label: "NAMA CC" },
    { key: "unitName", label: "UNIT KERJA" },
    { key: "submitted", label: "TOTAL SUBMIT" },
    { key: "approved", label: "DISETUJUI" },
    { key: "target", label: "TARGET" },
    { key: "approvalRate", label: "COMPLIANCE" },
    { key: "status", label: "STATUS" },
  ];

  const renderUnitCell = (item: RankingWilayah, columnKey: string) => {
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
      case "kegiatan":
        return <span className="font-bold text-gray-900">{item.kegiatan}</span>;
      case "disetujui":
        return (
          <div className="flex items-center gap-2 text-green-600">
            <BsCheckCircle className="w-4 h-4" />
            <span>{item.disetujui}</span>
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

  const renderCCCell = (item: RankingCC, columnKey: string) => {
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
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
              {item.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-gray-900">{item.name}</span>
          </div>
        );

      case "unitName":
        return <span className="text-gray-600 text-sm">{item.unitName}</span>;

      case "submitted":
        return (
          <span className="font-bold text-gray-900">{item.submitted}</span>
        );

      case "approved":
        return (
          <div className="flex items-center gap-2 text-green-600">
            <BsCheckCircle className="w-4 h-4" />
            <span>{item.approved}</span>
          </div>
        );

      case "target":
        return <span className="text-gray-500 text-sm">{item.target}</span>;

      case "approvalRate":
        return (
          <div className="flex items-center gap-3">
            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  item.approvalRate >= 50
                    ? "bg-green-500"
                    : item.approvalRate >= 25
                      ? "bg-orange-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${Math.min(item.approvalRate, 100)}%` }}
              />
            </div>
            <span className="font-bold text-gray-900">
              {item.approvalRate}%
            </span>
          </div>
        );

      case "status": {
        // On Track >= 50% | Behind 25-49% | At Risk < 25%
        let colorTheme: "success" | "warning" | "danger" = "danger";
        if (item.status === "On Track") colorTheme = "success";
        else if (item.status === "Behind") colorTheme = "warning";
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
  };

  return (
    <Card className="p-0">
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as RankingTab)}
      >
        <Card.Header className="p-4">
          <div className="flex items-center justify-between w-full">
            <div>
              <Card.Title className="text-md font-bold">
                {activeTab === "unit"
                  ? "Ranking Lengkap Unit Kerja per Wilayah"
                  : "Ranking Culture Catalyst (CC)"}
              </Card.Title>
              <Card.Description className="text-xs font-light">
                {activeTab === "unit"
                  ? "Diurutkan berdasarkan tingkat persetujuan tertinggi"
                  : "Diurutkan berdasarkan jumlah laporan disetujui terbanyak"}
              </Card.Description>
            </div>

            {/* Toggle Tab — HeroUI v3 Tabs */}
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab
                  id="unit"
                  className="group data-[selected=true]:text-blue-600 text-gray-500 text-xs font-medium transition-colors"
                >
                  Unit
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab
                  id="cc"
                  className="group data-[selected=true]:text-blue-600 text-gray-500 text-xs font-medium transition-colors"
                >
                  CC
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </div>
        </Card.Header>

        <Card.Content className="min-h-100">
          <Tabs.Panel id="unit">
            <DataTable
              column={unitColumns}
              data={data}
              renderCell={renderUnitCell}
              pagination={pagination}
              onPageChange={onPageChange}
            />
          </Tabs.Panel>
          <Tabs.Panel id="cc">
            <DataTable
              column={ccColumns}
              data={ccData}
              renderCell={renderCCCell}
              pagination={ccPagination}
              onPageChange={onCCPageChange}
            />
          </Tabs.Panel>
        </Card.Content>
      </Tabs>
    </Card>
  );
}
