import { Card } from "@heroui/react";

interface SummaryCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description: string;
  color: "blue" | "green" | "red" | "orange" | "purple";
}

export default function SummaryCard({
  title,
  value,
  icon,
  description,
  color,
}: SummaryCardProps) {
  const colorClasses = {
    blue: "bg-blue-50/80 text-blue-700 ring-1 ring-blue-200/50",
    green: "bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-200/50",
    red: "bg-red-50/80 text-red-700 ring-1 ring-red-200/50",
    orange: "bg-amber-50/80 text-amber-700 ring-1 ring-amber-200/50",
    purple: "bg-violet-50/80 text-violet-700 ring-1 ring-violet-200/50",
  };

  return (
    <Card className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-surface hover:shadow-(--surface-shadow-md) transition-all duration-200">
      <Card.Content className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <Card.Title className="text-sm font-medium text-gray-500">
              {title}
            </Card.Title>
            <Card.Description className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
              {value}
            </Card.Description>
          </div>
          <div
            className={`${colorClasses[color]} p-2.5 rounded-xl w-10 h-10 flex items-center justify-center`}
          >
            {icon}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <p className="text-[13px] font-medium text-gray-400">{description}</p>
        </div>
      </Card.Content>
    </Card>
  );
}
