"use client";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent
} from "@/components/ui/chart";
import { DistribusiProgram } from "@/types/analytics.type";
import { Tooltip as HeroTooltip } from "@heroui/react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

interface AnalyticPieChartProps {
  data?: DistribusiProgram[];
  selectedYear?: number;
}
export default function AnalyticPieChart({
  data,
  selectedYear = new Date().getFullYear(),
}: AnalyticPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-gray-500 text-sm">
        Tidak ada data untuk ditampilkan.
      </div>
    );
  }

  const chartConfig = {
    value: {
      label: "Jumlah Laporan",
    },
  } satisfies ChartConfig;

  const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="w-full flex flex-col gap-6">
      <ChartContainer config={chartConfig} className="h-[220px] w-full">
        <ResponsiveContainer width={"100%"} height={"100%"}>
          <PieChart>
            <Tooltip content={<ChartTooltipContent hideLabel />} />

            <Pie
              data={data}
              cx={"50%"}
              cy={"50%"}
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey={"value"}
              nameKey={"name"}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>

      <div className="flex flex-col gap-3 px-4">
        {data.map((entry, index) => {
          const percentage =
            total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
          const color = COLORS[index % COLORS.length];
          return (
            <div
              key={`legend-${index}`}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                {/* Tambahkan w-full & block agar truncate jalan sempurna */}
                <HeroTooltip delay={0}>
                  <HeroTooltip.Trigger>
                    <span className="text-sm text-gray-600 truncate max-w-[150px] md:max-w-[180px] block cursor-help">
                      {entry.name}
                    </span>
                  </HeroTooltip.Trigger>
                  <HeroTooltip.Content showArrow>
                    <HeroTooltip.Arrow />
                    <div className="px-1 py-1 text-xs text-gray-600 truncate">
                      {entry.name}
                    </div>
                  </HeroTooltip.Content>
                </HeroTooltip>
              </div>

              <span className="text-xs text-gray-800 ml-2 font-bold">
                {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
