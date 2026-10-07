import { ProgramInfo, QuarterFilter } from "@/types/compliance.types";
import { Card } from "@heroui/react";
import { FiTarget } from "react-icons/fi";

interface TableIndicatorsProps {
  data: ProgramInfo;
  year: number;
  tw: QuarterFilter;
}
const TW_LABELS: Record<Exclude<QuarterFilter, "ALL">, string> = {
  "1": "TW I",
  "2": "TW II",
  "3": "TW III",
  "4": "TW IV",
};

export default function TableIndicators({
  data,
  year,
  tw,
}: TableIndicatorsProps) {
  if (!data) return null;

  const targetLabel =
    tw === "ALL"
      ? `Target terdaftar ${year}`
      : `Target ${TW_LABELS[tw]}`;

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-[#0369a1] to-[#0284c7]">
      <Card.Header className="flex flex-row items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <FiTarget className="text-blue-800 w-5 h-5" />
        </div>
        <div>
          <Card.Title className="text-white font-bold text-md">
            {data.name}
          </Card.Title>
          <Card.Description className="text-gray-200 text-xs">
            {targetLabel}: <span>{data.frequency} laporan</span>
            <span> · Rumus: Approved ÷ {data.frequency} × 100%</span>
          </Card.Description>
        </div>
      </Card.Header>
    </Card>
  );
}
