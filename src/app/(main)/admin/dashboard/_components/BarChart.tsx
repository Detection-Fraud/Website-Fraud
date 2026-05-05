"use client";

import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { KegiatanPerBulan } from "@/types/analytics.type";

const chartConfig = {
  jumlah: {
    label: "Total Laporan",
    color: "#0284c7", // Tailwind sky-600
  },
} satisfies ChartConfig;

interface DashboardBarChartProps {
  data?: KegiatanPerBulan[];
}

export default function DashboardBarChart({ data = [] }: DashboardBarChartProps) {
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
          dataKey="bulan"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.substring(0, 3)}
        />
        <YAxis 
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="jumlah" fill="var(--color-jumlah)" radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ChartContainer>
  );
}