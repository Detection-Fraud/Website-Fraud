"use client";

import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { KegiatanPerBulan } from "@/types/analytics.type";
const chartConfig = {
  jumlah: {
    label: "Total Laporan",
    color: "#0284c7", // Tailwind sky-600
  },
} satisfies ChartConfig;

interface DashboardLineChartProps {
  data?: KegiatanPerBulan[];
}

export default function DashboardLineChart({ data = [] }: DashboardLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-gray-500 text-sm">
        Tidak ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
      {/* Komponen utama LineChart */}
      <LineChart
        accessibilityLayer // Menambahkan label ARIA otomatis
        data={data}
        margin={{
          top: 20, 
          left: 12,
          right: 12,
          bottom: 20,
        }}
      >
        <CartesianGrid vertical={false} />

        <XAxis
          dataKey="bulan"
          tickLine={false} 
          axisLine={false} 
          tickMargin={18} 
          tickFormatter={(value) => value.slice(0, 3)} 
        />

        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Line
          dataKey="jumlah" 
          type="natural" 
          stroke="var(--color-jumlah)" 
          strokeWidth={2} 
          dot={{ fill: "var(--color-jumlah)" }} 
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
