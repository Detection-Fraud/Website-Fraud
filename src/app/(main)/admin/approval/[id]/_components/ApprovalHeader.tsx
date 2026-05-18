import { ActivityReportItem } from "@/types/report.types";
import { Button, Chip, Spinner } from "@heroui/react";
import Link from "next/link";
import { FiArrowLeft, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";

interface ApprovalHeaderProps {
  report: ActivityReportItem | null;
  isLoading: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export default function ApprovalHeader({
  report,
  isLoading,
  onApprove,
  onReject,
}: ApprovalHeaderProps) {
  const getUnitType = () => {
    if (report?.division) return "divisi";
    if (report?.branch) return "kancab";
    if (report?.region) return "kanwil";
    return "kanwil";
  };

  const unitType = getUnitType();

  const getUnitName = () => {
    if (unitType === "divisi") return report?.division?.name;
    if (unitType === "kancab") return report?.branch?.name;
    return report?.region?.name;
  };

  return (
    <div className="space-y-2">
      <Link
        href={`/admin/approval`}
        className="flex items-center gap-2 text-gray-500 hover:underline mb-4"
      >
        <FiArrowLeft className="w-5 h-5" />
        <span className="font-medium">Kembali ke Approval</span>
      </Link>
      <div className="flex flex-row items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">
            {report?.activityName || "Memuat..."}
          </h2>
          <Chip color="accent" variant="soft">
            <LuBuilding2 />
            <Chip.Label>{getUnitName()}</Chip.Label>
          </Chip>
        </div>
        {report?.status === "PENDING" && (
          <div className="flex flex-row items-center gap-2">
            <Button
              variant="danger-soft"
              className={"bg-red-50 text-red-700 border border-red-200"}
              isDisabled={isLoading}
              onClick={onReject}
            >
              Reject
            </Button>
            <Button
              className={"bg-green-50 text-green-700 border-green-200 border"}
              isDisabled={isLoading}
              onClick={onApprove}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  Approving...
                  <Spinner size="sm" />
                </div>
              ) : (
                "Approved"
              )}
            </Button>
          </div>
        )}
        {report?.status === "APPROVED" && (
          <div className="flex items-center gap-2.5 px-5 py-3 bg-green-50 border border-green-200 rounded-xl ">
            <FiCheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                Upload Disetujui
              </p>
              <p className="text-xs text-green-600">
                Data kegiatan telah divalidasi Admin
              </p>
            </div>
          </div>
        )}
        {report?.status === "REJECTED" && (
          <div className="flex items-center gap-2.5 px-5 py-3 bg-red-50 border border-red-200 rounded-xl">
            <FiXCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                Upload Ditolak
              </p>
              <p className="text-xs text-red-600">
                {report.notes || "Pengajuan Tidak Memenuhi Syarat"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
