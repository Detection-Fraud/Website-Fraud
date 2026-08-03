"use client";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { KegiatanPerPeriode } from "@/types/analytics.type";
import {
  Bar,
  CartesianGrid,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
} from "recharts";

const chartConfig = {
  tahunIni: {
    label: "Tahun Ini",
    color: "#0284c7", // Tailwind sky-600
  },
  tahunLalu: {
    label: "Tahun Lalu",
    color: "#94a3b8", // Tailwind slate-400
  },
} satisfies ChartConfig;

interface DashboardBarChartProps {
  data?: KegiatanPerPeriode[];
  showComparison?: boolean;
}

export default function DashboardBarChart({
  data = [],
  showComparison = false,
}: DashboardBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-gray-500 text-sm">
        Tidak ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
      <RechartsBarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="periode"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) =>
            value ? String(value).substring(0, 3) : ""
          }
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={10} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        {showComparison && (
          <Bar
            dataKey="tahunLalu"
            fill="var(--color-tahunLalu)"
            radius={[4, 4, 0, 0]}
          />
        )}
        <Bar
          dataKey="tahunIni"
          fill="var(--color-tahunIni)"
          radius={[4, 4, 0, 0]}
        />
      </RechartsBarChart>
    </ChartContainer>
  );
}
