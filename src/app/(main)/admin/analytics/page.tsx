"use client";

import { Card, ListBox, Select, Tabs } from "@heroui/react";
import { BiFilterAlt } from "react-icons/bi";
import MiniCart from "./_components/MiniCart";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import DashboardBarChart from "../dashboard/_components/BarChart";
import DashboardLineChart from "../dashboard/_components/LineChart";

export default function AnalyticsAdmin() {
  const {
    summary,
    charts,
    isLoading,
    year,
    setYear,
    regionId,
    setRegionId,
    programId,
    setProgramId,
  } = useDashboardAnalytics();

  const currentMonth = summary?.laporanBulanIni || 0;
  const lastMonth = summary?.laporanBulanLalu || 0;

  const selisih = currentMonth - lastMonth;

  const subText =
    selisih >= 0 ? `+${selisih} vs bulan lalu` : `${selisih} vs bulan lalu`;

  const percentage = (
    ((summary?.totalApproved || 0) / (summary?.totalKegiatan || 1)) *
    100
  ).toFixed(2);

  return (
    <div>
      <div className="flex items-center gap-2">
        <BiFilterAlt className="w-4 h-4 text-gray-500" />
        <p className="text-gray-500 font-medium">Filter: </p>

        {/* Select Filter */}
        <div>
          <Select
            aria-label="Filter Status"
            placeholder="Semua Status"
            variant="primary"
            className={"w-48"}
          >
            <Select.Trigger className="shadow-sm bg-white border border-gray-200">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="ALL" textValue="Semua Status">
                  <ListBox.ItemIndicator />
                  Semua Status
                </ListBox.Item>
                <ListBox.Item id="PENDING" textValue="Pending">
                  <ListBox.ItemIndicator />
                  Pending
                </ListBox.Item>
                <ListBox.Item id="APPROVED" textValue="Approved">
                  <ListBox.ItemIndicator />
                  Approved
                </ListBox.Item>
                <ListBox.Item id="REJECTED" textValue="Rejected">
                  <ListBox.ItemIndicator />
                  Rejected
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-7">
        <MiniCart
          title="Total Kegiatan"
          value={summary?.totalKegiatan}
          sub={subText}
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

      <Card>
        <Tabs>
          {/* Baris Header: Title (kiri) + Tab Buttons (kanan) */}
          <div className="mb-4 flex flex-row justify-between items-center">
            <div>
              <h2 className="font-bold text-gray-900">
                Grafik Kegiatan per Bulan
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Jumlah laporan yang masuk setiap bulannya
              </p>
            </div>
            {/* Tab buttons di sini, sejajar dengan title */}
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab
                  id={"bar"}
                  className="group data-[selected=true]:text-blue-600 text-gray-500"
                >
                  Area
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab
                  id={"line"}
                  className="group data-[selected=true]:text-blue-600 text-gray-500"
                >
                  Bar
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </div>

          {/* Panel konten di BAWAH baris header */}
          <Tabs.Panel id={"bar"}>
          </Tabs.Panel>
          <Tabs.Panel id={"line"}>
            <DashboardLineChart data={charts?.kegiatanPerBulan} />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  );
}
