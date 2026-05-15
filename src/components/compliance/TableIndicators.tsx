import { ProgramInfo } from "@/types/compliance.types";
import { Card } from "@heroui/react";
import { FiTarget } from "react-icons/fi";

interface TableIndicatorsProps {
  data: ProgramInfo;
}
export default function TableIndicators({ data }: TableIndicatorsProps) {
  if (!data) return null;

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
            Target Frekuensi: <span>{data.frequency}x</span> per tahun
            <span> · Rumus: Approved ÷ {data.frequency} x 100%</span>
          </Card.Description>
        </div>
      </Card.Header>
    </Card>
  );
}
