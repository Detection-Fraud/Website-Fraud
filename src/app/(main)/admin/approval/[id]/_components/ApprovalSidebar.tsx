import { ActivityReportItem } from "@/types/report.types";
import { Avatar, Card } from "@heroui/react";
import { FiAlertTriangle, FiMapPin, FiUser } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";

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

  const unitStyle = getUnitStyle();

  const getUnitTypeLabel = () => {
    if (unitType === "divisi") return "Divisi";
    if (unitType === "kancab") return "Kantor Cabang";
    return "Kantor Wilayah";
  };

  const getUnitNameOnly = () => {
    if (report?.division?.name) return report.division.name;
    if (report?.branch?.name) return report.branch.name;
    if (report?.region?.name) return report.region.name;
    return "Memuat Unit...";
  };

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl p-5 border border-gray-200 shadow-sm">
        <Card.Header>
          <Card.Title>
            <div className="flex flex-row items-center gap-2 text-gray-500 mb-4 ">
              <FiUser className="w-5 h-5" />
              <p className="font-semibold tracking-wide text-sm uppercase">
                Person In Charge (PIC)
              </p>
            </div>
          </Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-row items-center gap-2">
          <Avatar size="md" className="rounded-xl ">
            <Avatar.Fallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white">
              {report?.picKegiatan?.charAt(0).toUpperCase() || "U"}
            </Avatar.Fallback>
          </Avatar>
          <p className="font-bold text-gray-900 text-base">
            {report?.picKegiatan || "Memuat PIC..."}
          </p>
        </Card.Content>
      </Card>
      <Card
        className={`rounded-2xl p-5 border shadow-sm bg-gradient-to-br ${unitStyle.bg} ${unitStyle.border}`}
      >
        <Card.Header>
          <Card.Title>
            <div className="flex flex-row items-center gap-2 text-gray-500 mb-4">
              <LuBuilding2 className="w-5 h-5" />
              <p className="font-semibold tracking-wide text-sm uppercase">
                Informasi Unit
              </p>
            </div>
          </Card.Title>
        </Card.Header>
        <Card.Content className="space-y-4">
          {/* Bagian 1: Tipe Unit */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Tipe Unit</p>
            <div
              className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${unitStyle.badge}`}
            >
              {getUnitTypeLabel()}
            </div>
          </div>

          {/* Bagian 2: Nama Unit */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Nama Unit</p>
            <p className={`text-lg font-bold ${unitStyle.text}`}>
              {getUnitNameOnly()}
            </p>
          </div>

          {/* Bagian 3: Lokasi */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Lokasi</p>
            <div className="flex items-center gap-1.5 text-gray-700 font-medium mt-1">
              <FiMapPin className="w-4 h-4 text-gray-500" />
              <span>{report?.lokasi || "Lokasi belum diisi"}</span>
            </div>
          </div>
        </Card.Content>
      </Card>
      {report?.status === "REJECTED" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 shadow-sm">
          <div className="flex gap-3">
            <FiAlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-900 mb-1">
                Catatan Admin
              </p>
              <p className="text-sm text-yellow-800 leading-relaxed">
                {report.notes || "Tidak ada catatan."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
