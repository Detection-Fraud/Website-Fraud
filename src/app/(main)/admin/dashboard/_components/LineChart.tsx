"use client";

import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { KegiatanPerPeriode } from "@/types/analytics.type";
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

interface DashboardLineChartProps {
  data?: KegiatanPerPeriode[];
  showComparison?: boolean;
}

export default function DashboardLineChart({ data = [], showComparison = false }: DashboardLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-gray-500 text-sm">
        Tidak ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[340px] w-full">
      {/* Komponen utama LineChart */}
      <LineChart
        accessibilityLayer // Menambahkan label ARIA otomatis
        data={data}
        margin={{
          top: 100, 
          left: 12,
          right: 12,
          bottom: 10,
        }}
      >
        <CartesianGrid vertical={false} />

        <XAxis
          dataKey="periode"
          tickLine={false} 
          axisLine={false} 
          tickMargin={18} 
          tickFormatter={(value) => value ? String(value).substring(0, 3) : ""} 
        />

        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        {showComparison && (
          <Line
            dataKey="tahunLalu" 
            type="natural" 
            stroke="var(--color-tahunLalu)" 
            strokeWidth={2} 
            dot={{ fill: "var(--color-tahunLalu)" }} 
            activeDot={{ r: 6 }} 
          />
        )}
        <Line
          dataKey="tahunIni" 
          type="natural" 
          stroke="var(--color-tahunIni)" 
          strokeWidth={2} 
          dot={{ fill: "var(--color-tahunIni)" }} 
          activeDot={{ r: 6 }} 
        >
          <LabelList
            position="top" 
            offset={12} 
            className="fill-foreground" 
            fontSize={12} 
          />
        </Line>
      </LineChart>
    </ChartContainer>
  );
}
