"use client";

import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { Card, ListBox, Select } from "@heroui/react";
import { BiFilterAlt } from "react-icons/bi";
import AnalyticChart from "./_components/AnalyticChart";
import MiniCart from "./_components/MiniCart";
import DataTable from "@/components/layout/DataTable";
import AnalyticTableRanking from "./_components/AnalyticTableRanking";
import { useMasterWilayah } from "@/hooks/useMasterWilayah";

export default function AnalyticsAdmin() {
  const {
    summary,
    charts,
    isLoading,
    areaChartData,
    periode,
    setPeriode,
    year,
    setYear,
    regionId,
    setRegionId,
    programId,
    pieChartData,
    setProgramId,
    dynamicSummary,
    branchId,
    setBranchId,
  } = useDashboardAnalytics();

  const { regions } = useMasterWilayah();

  const currentMonth = summary?.laporanBulanIni || 0;
  const lastMonth = summary?.laporanBulanLalu || 0;

  const selisih = currentMonth - lastMonth;

  const subText =
    selisih >= 0 ? `+${selisih} vs bulan lalu` : `${selisih} vs bulan lalu`;
  const diff = dynamicSummary.currentValue - dynamicSummary.previousValue;
  const dynamicSubText =
    diff >= 0 ? `+${diff} vs tahun lalu` : `${diff} vs tahun lalu`;
  const percentage = (
    ((summary?.totalApproved || 0) / (summary?.totalKegiatan || 1)) *
    100
  ).toFixed(2);

  const selectedRegion = regions.find((r) => r.id === regionId);

  const branches = selectedRegion ? selectedRegion.branches : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <BiFilterAlt className="w-4 h-4 text-gray-500" />
        <p className="text-gray-500 font-medium">Filter: </p>

        {/* Select Filter Wilayah */}
        <div>
          <Select
            aria-label="Filter Wilayah"
            placeholder="Semua Wilayah"
            variant="primary"
            className={"w-48"}
            selectedKey={regionId}
            onSelectionChange={(key) => {
              setRegionId((key ?? "ALL") as string);
              setBranchId("ALL"); // Reset kancab saat ganti wilayah
            }}
          >
            <Select.Trigger className="shadow-sm bg-white border border-gray-200">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="ALL" textValue="Semua Wilayah">
                  <ListBox.ItemIndicator />
                  Semua Wilayah
                </ListBox.Item>
                {regions?.map((region) => (
                  <ListBox.Item
                    key={region.id}
                    id={String(region.id)}
                    textValue={region.name}
                  >
                    <ListBox.ItemIndicator />
                    {region.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        {/* Select Filter Kantor Cabang */}
        <div>
          <Select
            aria-label="Filter Kantor Cabang"
            placeholder="Semua Kancab"
            variant="primary"
            className={"w-52"}
            isDisabled={regionId === "ALL"}
            value={branchId}
            onChange={(key) => {
              setBranchId((key ?? "ALL") as string);
            }}
          >
            <Select.Trigger className="shadow-sm bg-white border border-gray-200">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="ALL" textValue="Semua Kancab">
                  <ListBox.ItemIndicator />
                  Semua Kancab
                </ListBox.Item>
                {branches?.map((branch: any) => (
                  <ListBox.Item
                    key={branch.id}
                    id={String(branch.id)}
                    textValue={branch.name}
                  >
                    <ListBox.ItemIndicator />
                    {branch.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        {/* Select Filter Periode */}
        <div>
          <Select
            aria-label="Filter Periode Waktu"
            placeholder="Pilih Periode"
            value={periode}
            onChange={(key) => setPeriode((key ?? "ALL") as any)}
            className="w-48"
          >
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
      </div>

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
        <AnalyticTableRanking data={charts?.rankingWilayah || []} />
      </div>
    </div>
  );
}
