import { SummaryStats } from "@/types/report.types";
import { Card } from "@heroui/react";
import { BsCheck2Circle, BsXCircle } from "react-icons/bs";
import { FiAlertTriangle, FiImage } from "react-icons/fi";

interface ApprovalSummaryCardsProps {
  summary: SummaryStats;
}

export default function ApprovalSummaryCards({
  summary,
}: ApprovalSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <Card className="rounded-xl shadow-sm border-gray-200 hover:shadow-md transition-shadow">
          <Card.Header className="flex flex-row items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FiImage className="w-5 h-5 text-blue-600" />
            </div>
            <Card.Title>
              <p className="text-3xl font-bold leading-none text-[#0284c7]">
                {summary.total}
              </p>
              <p className="text-sm text-slate-700 font-semibold">
                Total Upload
              </p>
              <p className="text-slate-400 text-xs mt-0.5">Semua Unggahan</p>
            </Card.Title>
          </Card.Header>
        </Card>
      </div>
      <div>
        <Card className="rounded-xl shadow-sm border-gray-200 hover:shadow-md transition-shadow">
          <Card.Header className="flex flex-row items-start gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <FiAlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <Card.Title>
              <p className="text-3xl font-bold text-[#d97706] leading-none">
                {summary.pending}
              </p>
              <p className="text-sm text-slate-700 font-semibold">Menunggu</p>
              <p className="text-xs text-slate-400 mt-0.5">Total Menunggu</p>
            </Card.Title>
          </Card.Header>
        </Card>
      </div>
      <div>
        <Card className="rounded-xl shadow-sm border-gray-200 hover:shadow-md transition-shadow">
          <Card.Header className="flex flex-row items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <BsCheck2Circle className="w-5 h-5 text-green-600" />
            </div>
            <Card.Title>
              <p className="text-3xl font-bold text-[#059669] leading-none">
                {summary.approved}
              </p>
              <p className="text-sm text-slate-700 font-semibold">Disetujui</p>
              <p className="text-xs text-slate-400 mt-0.5">Total Disetujui</p>
            </Card.Title>
          </Card.Header>
        </Card>
      </div>
      <div>
        <Card className="rounded-xl shadow-sm border-gray-200 hover:shadow-md transition-shadow">
          <Card.Header className="flex flex-row items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <BsXCircle className="w-5 h-5 text-red-600" />
            </div>
            <Card.Title>
              <p className="text-3xl font-bold text-[#ef4444] leading-none">
                {summary.rejected}
              </p>
              <p className="text-sm text-slate-700 font-semibold">Ditolak</p>
              <p className="text-xs text-slate-400 mt-0.5">Total Ditolak</p>
            </Card.Title>
          </Card.Header>
        </Card>
      </div>
    </div>
  );
}
