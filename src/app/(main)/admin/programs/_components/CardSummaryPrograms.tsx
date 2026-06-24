import { ProgramSummary } from "@/hooks/useProgramQuery";
import { Card } from "@heroui/react";

interface CardSummaryProgramsProps {
  data: ProgramSummary;
}

export default function CardSummaryPrograms({
  data,
}: CardSummaryProgramsProps) {
  const summaryCards = [
    {
      title: "Total Program",
      value: data.total,
      color: "text-[#0284c7]",
    },
    {
      title: "Aktif Program",
      value: data.active,
      color: "text-[#059669]",
    },
    {
      title: "Nonaktif Program",
      value: data.inActive,
      color: "text-[#dc2626]",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {summaryCards.map((summaryCard, index) => (
        <div key={`${summaryCard.title}-${index}`}>
          <Card className="rounded-2xl shadow-sm border-slate-200 border">
            <Card.Header>
              <Card.Title className={`text-2xl font-bold ${summaryCard.color}`}>
                {summaryCard.value}
              </Card.Title>
              <Card.Description className="text-slate-500 text-xs">
                {summaryCard.title}
              </Card.Description>
            </Card.Header>
          </Card>
        </div>
      ))}
    </div>
  );
}
