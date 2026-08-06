"use client";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tooltip as HeroTooltip } from "@heroui/react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface AnalyticPieChartProps {
  data?: Array<{ name: string; value: number }>;
}

const chartConfig = {
  value: {
    label: "Jumlah Laporan",
  },
} satisfies ChartConfig;

const COLORS = [
  "#1e40af", // Deep Navy
  "#2563eb", // Royal Blue
  "#0284c7", // Sky Blue
  "#6366f1", // Indigo Accent
  "#0d9488", // Teal Accent
  "#94a3b8", // Slate 400 (Lainnya)
];
export default function AnalyticPieChart({ data }: AnalyticPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-65 items-center justify-center text-gray-400 text-xs font-medium">
        Tidak ada data untuk ditampilkan.
      </div>
    );
  }

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="w-full flex flex-col gap-4">
      <ChartContainer config={chartConfig} className="h-50 w-full">
        <ResponsiveContainer width={"100%"} height={"100%"}>
          <PieChart>
            <Tooltip content={<ChartTooltipContent hideLabel />} />

            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    // UPDATED: Warna fallback slate-400 khusus kategori "Lainnya"
                    entry.name === "Lainnya"
                      ? "#94a3b8"
                      : COLORS[index % COLORS.length]
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>

      <div className="flex flex-col gap-2.5 px-2 max-h-45 overflow-y-auto custom-scrollbar">
        {data.map((entry, index) => {
          const percentage =
            total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
          const color = // UPDATED: Match warna legend "Lainnya"
            entry.name === "Lainnya"
              ? "#94a3b8"
              : COLORS[index % COLORS.length];

          return (
            <div
              key={`legend-${index}`}
              className="flex items-center justify-between py-0.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <HeroTooltip delay={0}>
                  <HeroTooltip.Trigger>
                    <span className="text-xs font-medium text-slate-600 truncate max-w-40 sm:max-w-50 block cursor-help">
                      {entry.name}
                    </span>
                  </HeroTooltip.Trigger>
                  <HeroTooltip.Content showArrow>
                    <HeroTooltip.Arrow />
                    <div className="px-1 py-1 text-xs text-slate-700">
                      {entry.name} ({entry.value} Laporan)
                    </div>
                  </HeroTooltip.Content>
                </HeroTooltip>
              </div>

              <span className="text-xs text-slate-800 ml-2 font-bold shrink-0">
                {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
