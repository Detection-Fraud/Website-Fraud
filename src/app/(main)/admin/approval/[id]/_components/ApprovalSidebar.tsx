import { ActivityReportItem } from "@/types/report.types";
import { Card } from "@heroui/react";
import { formatDate } from "date-fns";
import { FiCalendar, FiMapPin, FiUser } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";
import ApprovalPhotos from "./ApprovalPhotos";

interface ApprovalSidebarProps {
  report: ActivityReportItem | null;
}

export default function ApprovalSidebar({ report }: ApprovalSidebarProps) {
  const getUnitType = () => {
    if (report?.division) return "divisi";
    if (report?.branch) return "kancab";
    if (report?.region) return "kanwil";
    return "kanwil";
  };

  const unitType = getUnitType();

  const getUnitStyle = () => {
    const map: Record<
      string,
      { badge: string; bg: string; border: string; text: string }
    > = {
      kanwil: {
        badge: "bg-blue-100 text-blue-700 border border-blue-200",
        bg: "from-blue-50 to-indigo-50",
        border: "border-blue-200",
        text: "text-blue-700",
      },
      kancab: {
        badge: "bg-green-100 text-green-700 border border-green-200",
        bg: "from-green-50 to-emerald-50",
        border: "border-green-200",
        text: "text-green-700",
      },
      divisi: {
        badge: "bg-purple-100 text-purple-700 border border-purple-200",
        bg: "from-purple-50 to-violet-50",
        border: "border-purple-200",
        text: "text-purple-700",
      },
    };
    return map[unitType] || map.kanwil;
  };

  const getUnitNameOnly = () => {
    if (report?.division?.name) return `Divisi ${report.division.name}`;
    if (report?.branch?.name) return `Kantor Cabang ${report.branch.name}`;
    if (report?.region?.name) return `Kantor Wilayah ${report.region.name}`;
    return "Memuat Unit...";
  };

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl p-5 border border-gray-200 shadow-sm">
        <Card.Header>
          <Card.Title>
            <p className="font-bold">Informasi Kegiatan</p>
          </Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#f8fafc] p-[14px] rounded-lg">
              <div className="flex flex-row items-center gap-2 text-gray-500 shrink-0">
                <LuBuilding2 className="text-slate-500 w-3.5 h-3.5" />
                <p className="text-xs">Unit Kerja</p>
              </div>
              <p className="font-semibold text-md text-[#314158]">
                {getUnitNameOnly()}
              </p>
            </div>

            <div className="bg-[#f8fafc] p-[14px] rounded-lg">
              <div className="flex flex-row items-center gap-2 text-gray-500 shrink-0">
                <FiCalendar className="text-slate-500 w-3.5 h-3.5" />
                <p className="text-xs">Tanggal</p>
              </div>
              <p className="font-semibold text-md text-[#314158]">
                {formatDate(report?.createdAt ?? "", "dd MMM yyyy")}
              </p>
            </div>

            <div className="bg-[#f8fafc] p-[14px] rounded-lg">
              <div className="flex flex-row items-center gap-2 text-gray-500 shrink-0">
                <FiMapPin className="text-slate-500 w-3.5 h-3.5" />
                <p className="text-xs">Lokasi</p>
              </div>
              <p className="font-semibold text-md text-[#314158]">
                {report?.lokasi}
              </p>
            </div>
            <div className="bg-[#f8fafc] p-[14px] rounded-lg">
              <div className="flex flex-row items-center gap-2 text-gray-500 shrink-0">
                <FiUser className="text-slate-500 w-3.5 h-3.5" />
                <p className="text-xs">PIC Pelapor</p>
              </div>
              <p className="font-semibold text-md text-[#314158]">
                {report?.picKegiatan}
              </p>
            </div>
          </div>

          <div className="bg-[#e0f2fe] p-[14px] rounded-2xl w-full">
            <p className="text-[#0ea5e9]">Program Budaya</p>
            <p className="text-md font-semibold text-[#0369a1]">
              {report?.program?.name}
            </p>
          </div>

          <div className="space-y-1 px-[10px]">
            <p className="text-md font-semibold text-[#62748e]">
              Deskripsi Kegiatan
            </p>
            <p className="text-sm text-gray-400">{report?.description}</p>
          </div>

          {report?.status === "REJECTED" && (
            <div className="bg-red-50 border border-red-300 p-[14px] rounded-xl">
              <p className="text-red-800">Catatan Penolakan</p>
              <p className="text-sm text-red-700">{report?.notes}</p>
            </div>
          )}
        </Card.Content>
      </Card>
      <ApprovalPhotos report={report} />
    </div>
  );
}
