"use client";

import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { KegiatanPerPeriode } from "@/types/analytics.type";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

interface DashboardAreaChartProps {
  data?: KegiatanPerPeriode[];
  selectedYear?: number;
}
export default function AnalyticAreaChart({
  data,
  selectedYear = new Date().getFullYear(),
}: DashboardAreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-gray-500 text-sm">
        Tidak ada data untuk ditampilkan.
      </div>
    );
  }

  const chartConfig = {
    tahunIni: {
      label: `Tahun ${selectedYear}`,
      color: "#2563eb",
    },
    tahunLalu: {
      label: `Tahun ${selectedYear - 1}`,
      color: "#60a5fa",
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[300px] w-full p-4 rounded-xl "
    >
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{
          top: 80,
          left: 12,
          right: 12,
          bottom: 20,
        }}
      >
        <CartesianGrid vertical={false} />

        <XAxis
          dataKey={"periode"}
          tickLine={false}
          axisLine={false}
          tickMargin={18}
          tickFormatter={(value) => value.slice(0, 3)}
          tick={{
            fill: "#64748B",
            fontSize: 12,
          }}
        />

        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />

        <Area
          dataKey={"tahunLalu"}
          type={"natural"}
          fillOpacity={0.4}
          fill="var(--color-tahunLalu)"
          strokeWidth={2}
          stackId={"a"}
        />

        <Area
          dataKey={"tahunIni"}
          type={"natural"}
          fillOpacity={0.4}
          fill="var(--color-tahunIni)"
          stroke={"var(--color-tahunIni)"}
          stackId={"a"}
        />

        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
