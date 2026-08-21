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

  const currentMonthName = new Intl.DateTimeFormat("id-ID", {
    month: "long",
  }).format(new Date());

  const percentage = (
    ((summary?.totalApproved || 0) / (summary?.totalKegiatan || 1)) *
    100
  ).toFixed(2);

  return (
    <div className="space-y-6">
      <AppBar
        title="Dashboard Monitoring"
        description={`Pemantauan performa kegiatan budaya perusahaan tahun ${year}`}
        showAddButton={false}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Kegiatan"
          value={summary?.totalKegiatan || 0}
          icon={<PiPackage className="w-5 h-5" />}
          description={`Sepanjang ${year}`}
          color="blue"
        />
        <SummaryCard
          title="Unit Aktif"
          value={summary?.totalUnitAktif || 0}
          icon={<LuBuilding2 className="w-5 h-5" />}
          description={"Kanwil, Kancab, dan Divisi"}
          color="green"
        />
        <SummaryCard
          title="Laporan Bulan Ini"
          value={summary?.laporanBulanIni || 0}
          icon={<LuCalendarDays className="w-5 h-5" />}
          description={`Data bulan ${currentMonthName} ${year}`}
          color="purple"
        />
        <SummaryCard
          title="Tingkat Persetujuan"
          value={`${percentage}%`}
          icon={<IoIosCheckmarkCircleOutline className="w-5 h-5" />}
          description={"Tervalidasi (Approved)"}
          color="orange"
        />
      </div>

      <ChartSection summary={summary} charts={charts} />
    </div>
  );
}
