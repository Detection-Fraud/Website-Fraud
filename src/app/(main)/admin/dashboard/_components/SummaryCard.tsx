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
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Card className="bg-white rounded-2xl p-6 border border-gray-100 shadow-none hover:shadow-sm transition-all duration-200">
      <Card.Content className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <Card.Title className="text-sm font-medium text-gray-500">
              {title}
            </Card.Title>
            <Card.Description className="text-3xl font-bold text-gray-900">
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
