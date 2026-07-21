"use client";

import SelectDivisi from "@/components/ui/SelectDivisi";
import SelectKancab from "@/components/ui/SelectKancab";
import SelectUnitType, { UnitTypeFilter } from "@/components/ui/SelectUnitType";
import SelectWilayah from "@/components/ui/SelectWilayah";
import {
  PeriodeFilter,
  useDashboardAnalytics,
} from "@/hooks/useDashboardAnalytics";
import { Card, Label, ListBox, Select } from "@heroui/react";
import { BiFilterAlt } from "react-icons/bi";
import AnalyticChart from "./_components/AnalyticChart";
import AnalyticTableRanking from "./_components/AnalyticTableRanking";
import MiniCart from "./_components/MiniCart";

export default function AnalyticsAdmin() {
  const {
    summary,
    charts,
    areaChartData,
    periode,
    setPeriode,
    kanwilId,
    setKanwilId,
    kancabId,
    setKancabId,
    year,
    pieChartData,
    dynamicSummary,
    divisiId,
    setDivisiId,
    rankingPage,
    setRankingPage,
    unitType,
    setUnitType,
    kanwilList,
    divisiList,
    kancabList,
  } = useDashboardAnalytics();

  const currentMonth = summary?.laporanBulanIni || 0;
  const lastMonth = summary?.laporanBulanLalu || 0;

  const diff = dynamicSummary.currentValue - dynamicSummary.previousValue;
  const dynamicSubText =
    diff >= 0 ? `+${diff} vs tahun lalu` : `${diff} vs tahun lalu`;

  const percentage = (
    ((summary?.totalApproved || 0) / (summary?.totalKegiatan || 1)) *
    100
  ).toFixed(2);
  
  const handleUnitTypeChange = (val: UnitTypeFilter) => {
    setUnitType(val);
    setKanwilId("ALL");
  };

  return (
    <div className="space-y-8">
      <Card>
        <Card.Header className="flex flex-row items-center gap-2 border-b border-gray-100 pb-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <BiFilterAlt className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-gray-700 font-semibold text-sm">
            Filter Analytics
          </p>
        </Card.Header>

        <Card.Content
          className={`grid grid-cols-1 sm:grid-cols-2 ${unitType === "CABANG" ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-4 pt-4`}
        >
          <div className="flex-1 min-w-[200px]">
            <SelectUnitType
              value={unitType}
              onChange={handleUnitTypeChange}
              className="w-full sm:w-44"
            />
          </div>
          {/* Select Filter Wilayah */}
          {(unitType === "WILAYAH" || unitType === "CABANG") && (
            <div className="flex-1 min-w-[200px]">
              <SelectWilayah
                regions={kanwilList}
                value={kanwilId}
                onChange={(val) => {
                  setKanwilId(val);
                  setRankingPage(1);
                }}
                className="w-full sm:w-52 lg:w-62"
              />
            </div>
          )}

          {/* Select Filter Kantor Cabang */}
          {unitType === "CABANG" && (
            <div className="flex-1 min-w-[200px]">
              <SelectKancab
                branches={kancabList}
                value={kancabId}
                isDisabled={kanwilId === "ALL" || divisiId !== "ALL"}
                onChange={(val) => {
                  setKancabId(val);
                  setRankingPage(1);
                }}
                className="w-full sm:w-52 lg:w-62"
              />
            </div>
          )}

          {unitType === "DIVISI" && (
            <div className="flex-1 min-w-[200px]">
              <SelectDivisi
                divisiList={divisiList}
                value={divisiId}
                onChange={(val) => {
                  setDivisiId(val);
                  setRankingPage(1); // ← reset pagination
                }}
                isDisabled={kanwilId !== "ALL"} // ← disable jika Kanwil sedang dipilih
                className="w-full sm:w-52 lg:w-62"
              />
            </div>
          )}

          {/* Select Filter Periode */}
          <div className="flex-1 min-w-[200px]">
            <Select
              aria-label="Filter Periode Waktu"
              placeholder="Pilih Periode"
              value={periode}
              onChange={(key) => {
                setPeriode((key ?? "ALL") as PeriodeFilter);
                setRankingPage(1);
              }}
              className="w-full sm:w-48 lg:w-62"
            >
              <Label>Periode</Label>
              <Select.Trigger className="shadow-sm bg-white border border-gray-200">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="ALL" textValue="Sepanjang Tahun">
                    <ListBox.ItemIndicator />
                    Sepanjang Tahun
                  </ListBox.Item>
                  <ListBox.Item id="TW1" textValue="Triwulan 1">
                    <ListBox.ItemIndicator />
                    Triwulanan 1
                  </ListBox.Item>
                  <ListBox.Item id="TW2" textValue="Triwulan 2">
                    <ListBox.ItemIndicator />
                    Triwulanan 2
                  </ListBox.Item>
                  <ListBox.Item id="TW3" textValue="Triwulan 3">
                    <ListBox.ItemIndicator />
                    Triwulanan 3
                  </ListBox.Item>
                  <ListBox.Item id="TW4" textValue="Triwulan 4">
                    <ListBox.ItemIndicator />
                    Triwulanan 4
                  </ListBox.Item>
                  <ListBox.Item id="SM1" textValue="Semester 1">
                    <ListBox.ItemIndicator />
                    Semesteran 1
                  </ListBox.Item>
                  <ListBox.Item id="SM2" textValue="Semester 2">
                    <ListBox.ItemIndicator />
                    Semesteran 2
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </Card.Content>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-7">
        <MiniCart
          title="Total Kegiatan"
          value={dynamicSummary.currentValue}
          sub={dynamicSubText}
          color="bg-blue-50 text-blue-900"
        />
        <MiniCart
          title="Disetujui"
          value={summary?.totalApproved}
          sub={`${percentage}% approval rate`}
          color="bg-green-50 text-green-900"
        />
        <MiniCart
          title="Ditolak"
          value={summary?.totalRejected}
          sub={`Laporan Ditolak`}
          color="bg-red-50 text-red-900"
        />
        <MiniCart
          title="Pending"
          value={summary?.totalPending}
          sub={`Laporan Pending`}
          color="bg-orange-50 text-orange-900"
        />
      </div>

      <AnalyticChart
        periode={periode}
        year={year}
        report={dynamicSummary.currentValue}
        areaChartData={areaChartData || []}
        pieChartData={pieChartData || []}
      />

      <div className="mb-20">
        <AnalyticTableRanking
          data={charts?.rankingWilayah || []}
          pagination={{
            total: charts?.rankingTotal ?? 0,
            page: charts?.rankingPage ?? 1,
            limit: 10,
            totalPages: charts?.rankingTotalPages ?? 1,
          }}
          onPageChange={(page) => setRankingPage(page)}
        />
      </div>
    </div>
  );
}
