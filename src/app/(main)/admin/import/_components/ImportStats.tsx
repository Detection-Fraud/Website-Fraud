import { ImportStats } from "@/types/import.types";
import { Card } from "@heroui/react";
import { FiDatabase, FiFile } from "react-icons/fi";
import {
  MdOutlineCheckCircle,
  MdOutlineError,
  MdOutlineSwapHoriz,
} from "react-icons/md";

interface StatsBarProps {
  stats: ImportStats;
  fileName?: string;
}

export default function StatsBars({ stats, fileName }: StatsBarProps) {
  const items = [
    {
      label: "Total Baris",
      value: stats.total,
      icon: <FiDatabase size={18} className="text-blue-500" />,
      iconBg: "bg-blue-50",
      valueClass: "text-gray-900",
    },
    {
      label: "Karyawan Baru",
      value: stats?.baru || 0,
      icon: <MdOutlineCheckCircle size={18} className="text-green-500" />,
      iconBg: "bg-green-50",
      valueClass: "text-green-600",
    },
    {
      label: "Mutasi Unit",
      value: stats?.mutasi || 0,
      icon: <MdOutlineSwapHoriz size={18} className="text-orange-500" />,
      iconBg: "bg-orange-50",
      valueClass: "text-orange-600",
    },
    {
      label: "Error / Skip",
      value: stats.error,
      icon: <MdOutlineError size={18} className="text-red-500" />,
      iconBg: "bg-red-50",
      valueClass: "text-red-600",
    },
    {
      label: "Nama File",
      value: fileName ?? "-",
      icon: <FiFile size={18} className="text-sky-500" />,
      iconBg: "bg-sky-50",
      valueClass: "text-gray-700 text-xs truncate w-36",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <Card key={item.label} className="p-4 rounded-xl ">
          <Card.Content className="p-0 flex items-center gap-3 justify-center">
            <div
              className={`w-9 h-9 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}
            >
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium leading-tight">
                {item.label}
              </p>
              <p
                className={`font-bold text-xl text-center leading-tight ${item.valueClass}`}
                title={String(item.value)}
              >
                {item.value}
              </p>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
