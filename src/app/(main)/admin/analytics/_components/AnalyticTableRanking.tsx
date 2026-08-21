"use client";

import DataTable from "@/components/layout/DataTable";
import { RankingCC, RankingWilayah } from "@/types/analytics.type";
import { PaginationInfo } from "@/types/report.types";
import { Card, Tabs } from "@heroui/react";
import { useState } from "react";
import { ccRankingColumns, renderCCRankingCell } from "./ranking/columns-cc";
import {
  renderUnitRankingCell,
  unitRankingColumns,
} from "./ranking/columns-unit";

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

  return (
    <Card className="p-0 bg-white border border-slate-200/60 shadow-surface hover:shadow-(--surface-shadow-md) transition-all duration-200 rounded-2xl overflow-hidden">
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
                  className="group data-[selected=true]:text-blue-600 text-slate-500 text-xs font-medium transition-colors"
                >
                  Unit
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab
                  id="cc"
                  className="group data-[selected=true]:text-blue-600 text-slate-500 text-xs font-medium transition-colors"
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
              column={unitRankingColumns}
              data={data}
              renderCell={renderUnitRankingCell}
              pagination={pagination}
              onPageChange={onPageChange}
            />
          </Tabs.Panel>
          <Tabs.Panel id="cc">
            <DataTable
              column={ccRankingColumns}
              data={ccData}
              renderCell={renderCCRankingCell}
              pagination={ccPagination}
              onPageChange={onCCPageChange}
            />
          </Tabs.Panel>
        </Card.Content>
      </Tabs>
    </Card>
  );
}
