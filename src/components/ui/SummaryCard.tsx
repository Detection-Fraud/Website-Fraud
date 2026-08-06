import { Card } from "@heroui/react";

interface ApprovalSummaryCardsProps {
  summary: {
    value: number;
    title?: string;
    description?: string;
    icon: React.ComponentType<{ className?: string }>;
    style: string;
    textColor: string;
  }[];
}

export default function SummaryCards({ summary }: ApprovalSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {summary.map((item, index) => (
        <div key={index} className="min-w-0">
          <Card className="bg-white rounded-2xl border border-slate-200/60 shadow-surface hover:shadow-(--surface-shadow-md) transition-all duration-200">
            <Card.Header className="flex flex-row items-start gap-4">
              <div
                className={`w-12 h-12 ${item.style} rounded-xl flex items-center justify-center`}
              >
                <item.icon className={`w-5 h-5 ${item.textColor}`} />
              </div>
              <Card.Title>
                <p
                  className={`text-3xl font-bold leading-none tabular-nums ${item.textColor}`}
                >
                  {item.value}
                </p>
                {item.title && (
                  <p className="text-sm text-slate-700 font-semibold">
                    {item.title}
                  </p>
                )}
                {item.description && (
                  <p className="text-slate-400 text-xs mt-0.5">
                    {item.description}
                  </p>
                )}
              </Card.Title>
            </Card.Header>
          </Card>
        </div>
      ))}
    </div>
  );
}
