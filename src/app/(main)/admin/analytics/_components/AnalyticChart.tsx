import { PeriodeFilter } from "@/hooks/useDashboardAnalytics";
import { Card, Chip, Tabs } from "@heroui/react";
import AnalyticAreaChart from "./AnalyticAreaChart";
import AnalyticsBarChart from "./AnalyticPieChart";
import {
  DashboardData,
  DistribusiProgram,
  KegiatanPerPeriode,
} from "@/types/analytics.type";
import { BiTrendingUp } from "react-icons/bi";
import AnalyticPieChart from "./AnalyticPieChart";

interface AnalyticChartProps {
  periode: PeriodeFilter;
  year: number;
  areaChartData: KegiatanPerPeriode[];
  pieChartData: DistribusiProgram[];
  report: number;
}

export default function AnlyticChart({
  periode,
  year,
  areaChartData,
  pieChartData,
  report,
}: AnalyticChartProps) {
  const formatTitle = () => {
    switch (periode) {
      case "ALL":
        return "Sepanjang Tahun";
      case "TW1":
        return "Triwulan 1 (Jan-Mar)";
      case "TW2":
        return "Triwulan 2 (Apr-Jun)";
      case "TW3":
        return "Triwulan 3 (Jul-Sep)";
      case "TW4":
        return "Triwulan 4 (Okt-Des)";
      case "SM1":
        return "Semester 1 (Jan-Jun)";
      case "SM2":
        return "Semester 2 (Jul-Des)";
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 ">
      <Card className="p-4 bg-white border-gray-200 shadow-sm lg:col-span-2 rounded-2xl ">
        <div className="mb-4 flex flex-row justify-between items-center">
          <Card.Header>
            <Card.Title className="font-bold text-md">
              Tren Kegiatan Per {formatTitle()}
            </Card.Title>
            <Card.Description className="text-xs font-medium">
              {report} Laporan · {formatTitle()}
            </Card.Description>
          </Card.Header>
          <Chip size="md" color="accent" variant="primary">
            <BiTrendingUp className="w-3.5 h-3.5" />
            <Chip.Label>{formatTitle()}</Chip.Label>
          </Chip>
        </div>

        <Card.Content>
          <AnalyticAreaChart data={areaChartData} selectedYear={year} />
        </Card.Content>
      </Card>

      <Card className="rounded-2xl p-6">
        <Card.Header>
          <Card.Title className="font-bold text-md">
            Distribusi Program
          </Card.Title>
          <Card.Description className="font-light text-xs">
            Per jenis program budaya
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <AnalyticPieChart data={pieChartData} />
        </Card.Content>
      </Card>
    </div>
  );
}
