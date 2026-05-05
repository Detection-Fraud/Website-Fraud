import { Card } from "@heroui/react";
import { BiTask } from "react-icons/bi";

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
    blue: "bg-blue-600 text-white",
    green: "bg-green-600 text-white",
    red: "bg-red-600 text-white",
    orange: "bg-orange-600 text-white",
    purple: "bg-purple-600 text-white",
  };
  return (
    <Card className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <Card.Content className="flex items-start justify-between gap-3">
        <div
          className={`${colorClasses[color]} p-3 rounded-xl shadow-sm w-11 h-11 flex items-center justify-center`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <Card.Title className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
            {title}
          </Card.Title>
          <Card.Description className="text-3xl font-bold text-gray-900 mb-1">
            {value}
          </Card.Description>
          <p className="text-xs text-gray-400 mt-3">{description}</p>
        </div>
      </Card.Content>
    </Card>
  );
}
