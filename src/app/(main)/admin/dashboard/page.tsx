"use client";

import {
  Card,
  Chip,
  Link,
  ListBox,
  ProgressBar,
  Select,
  Tabs,
} from "@heroui/react";
import { BiFilterAlt, BiTask } from "react-icons/bi";
import SummaryCard from "./_components/SummaryCard";
import DashboardBarChart from "./_components/BarChart";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { PiPackage } from "react-icons/pi";
import { LuBuilding2, LuCalendarDays, LuMedal } from "react-icons/lu";
import { IoIosCheckmarkCircleOutline } from "react-icons/io";
import DashboardLineChart from "./_components/LineChart";
import {
  FiBarChart2,
  FiMinus,
  FiTrendingDown,
  FiTrendingUp,
} from "react-icons/fi";
import { BiLineChart, BiAward } from "react-icons/bi";
import { GoTrophy, GoArrowUpRight } from "react-icons/go";
import ChartSection from "./_components/ChartSection";
import DashboardPieChart from "./_components/PieChart";
import { MdOutlineShield } from "react-icons/md";

export default function DashboardAdmin() {
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
  const currentMonthName = new Intl.DateTimeFormat("id-ID", {
    month: "long",
  }).format(new Date());

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* SUMMARY KEGIATAN */}
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
          description={`Data untuk bulan ${currentMonthName} ${year}`}
          color="purple"
        />
        <SummaryCard
          title="Tingkat Persetujuan"
          value={`${(((summary?.laporanBulanIni || 0) / (summary?.totalKegiatan || 1)) * 100).toFixed(2)}%`}
          icon={<IoIosCheckmarkCircleOutline className="w-5 h-5" />}
          description={"Tervalidasi"}
          color="orange"
        />
      </div>

      {/* Chart Section */}
      <ChartSection summary={summary} charts={charts} />
    </div>
  );
}
