"use client";

import AppBar from "@/components/layout/Appbar";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { IoIosCheckmarkCircleOutline } from "react-icons/io";
import { LuBuilding2, LuCalendarDays } from "react-icons/lu";
import { PiPackage } from "react-icons/pi";
import ChartSection from "./ChartSection";
import SummaryCard from "./SummaryCard";

export default function DashboardView() {
  const { summary, charts, year } = useDashboardAnalytics();

  const now = new Date();
  const currentMonthName = new Intl.DateTimeFormat("id-ID", {
    month: "long",
  }).format(now);

  const percentage = (
    ((summary?.totalApproved || 0) / (summary?.totalKegiatan || 1)) *
    100
  ).toFixed(2);

  return (
    <div className="space-y-6">
      <AppBar
        title="Dashboard Monitoring"
        description={`Pemantauan laporan kegiatan dan partisipasi dengan evidence tahun ${year}`}
        showAddButton={false}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Laporan"
          value={summary?.totalKegiatan || 0}
          icon={<PiPackage className="w-5 h-5" />}
          description={`Kegiatan & partisipasi dengan evidence · ${year}`}
          color="blue"
        />
        <SummaryCard
          title="Unit yang Melapor"
          value={summary?.totalUnitAktif || 0}
          icon={<LuBuilding2 className="w-5 h-5" />}
          description={"Kanwil, Kancab, dan Divisi"}
          color="green"
        />
        <SummaryCard
          title="Upload Bulan Ini"
          value={summary?.laporanBulanIni || 0}
          icon={<LuCalendarDays className="w-5 h-5" />}
          description={`Diunggah pada ${currentMonthName} ${now.getFullYear()}`}
          color="purple"
        />
        <SummaryCard
          title="Tingkat Persetujuan"
          value={`${percentage}%`}
          icon={<IoIosCheckmarkCircleOutline className="w-5 h-5" />}
          description={"Laporan dengan evidence yang disetujui"}
          color="orange"
        />
      </div>

      <ChartSection summary={summary} charts={charts} />
    </div>
  );
}
