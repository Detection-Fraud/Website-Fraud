import { ProgramSummary } from "@/hooks/useProgramQuery";
import { Card } from "@heroui/react";
import { FiActivity, FiLayers, FiPause } from "react-icons/fi";

interface CardSummaryProgramsProps {
  data: ProgramSummary;
}

const summaryConfig = [
  {
    key: "total" as const,
    title: "Total Program",
    subtitle: "Seluruh program terdaftar",
    borderAccent: "border-l-indigo-400",
    valueColor: "text-indigo-600 dark:text-indigo-400",
    bgIcon: "text-indigo-200 dark:text-indigo-800",
    icon: FiLayers,
  },
  {
    key: "active" as const,
    title: "Program Aktif",
    subtitle: "Sedang berjalan",
    borderAccent: "border-l-emerald-400",
    valueColor: "text-emerald-600 dark:text-emerald-400",
    bgIcon: "text-emerald-200 dark:text-emerald-800",
    icon: FiActivity,
  },
  {
    key: "inActive" as const,
    title: "Program Nonaktif",
    subtitle: "Dihentikan atau belum dimulai",
    borderAccent: "border-l-zinc-300 dark:border-l-zinc-600",
    valueColor: "text-zinc-500 dark:text-zinc-400",
    bgIcon: "text-zinc-200 dark:text-zinc-700",
    icon: FiPause,
  },
];

export default function CardSummaryPrograms({
  data,
}: CardSummaryProgramsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {summaryConfig.map((config) => {
        const Icon = config.icon;
        return (
          <Card
            key={config.key}
            variant="default"
            className={`
              relative overflow-hidden
              border border-zinc-200 dark:border-zinc-800
              border-l-4 ${config.borderAccent}
              bg-white dark:bg-zinc-900
              rounded-xl shadow-sm
            `}
          >
            <Card.Content className="px-5 py-4 flex flex-col gap-1">
              {/* Label atas */}
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {config.title}
              </p>

              {/* Angka utama */}
              <p
                className={`text-3xl font-bold tracking-tight ${config.valueColor}`}
              >
                {data[config.key]}
              </p>

              {/* Keterangan bawah */}
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {config.subtitle}
              </p>

              {/* Icon dekoratif — transparansi tinggi, tidak mengganggu */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Icon className={`w-12 h-12 ${config.bgIcon} opacity-30`} />
              </div>
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );
}
