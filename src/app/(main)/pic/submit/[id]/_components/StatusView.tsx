import { StatusType } from "@/types/status.types";
import { Button, Card } from "@heroui/react";
import { useRouter } from "next/navigation";
import { CiClock2 } from "react-icons/ci";
import { FiAlertTriangle, FiMessageSquare, FiXCircle } from "react-icons/fi";
import { IoMdCheckmarkCircleOutline } from "react-icons/io";

interface StatusViewProps {
  status: StatusType;
  sentDate?: string;
  note?: string;
  updatedAt?: string;
  reportId?: string;
  canResubmit?: boolean;
}

export default function StatusView({
  status,
  sentDate,
  note,
  updatedAt,
  reportId,
  canResubmit,
}: StatusViewProps) {
  const router = useRouter();

  return (
    <div>
      {status === "PENDING" ? (
        <Card className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
          <Card.Content className="flex flex-row items-start gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
              <FiAlertTriangle className="w-7 h-7 text-orange-800" />
            </div>
            <div>
              <p className="font-bold text-orange-800 text-lg">
                Menunggu Validasi Admin
              </p>
              <p className="text-sm text-orange-700 mt-0.5">
                Pengajuan Anda sedang dalam antrian review oleh Admin Pusat
                BULOG. Harap tunggu konfirmasi.
              </p>
              <p className="text-xs text-orange-600 mt-2 flex items-center gap-1.5">
                <CiClock2 className="w-4 h-4" />
                Dikirim pada: {sentDate}
              </p>
            </div>
          </Card.Content>
        </Card>
      ) : status === "APPROVED" ? (
        <Card className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <Card.Content className="flex flex-row items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <IoMdCheckmarkCircleOutline className="w-7 h-7 text-green-800" />
            </div>
            <div>
              <p className="font-bold text-green-800 text-lg">
                Pengajuan Disetujui
              </p>
              <p className="text-sm text-green-700 mt-0.5">
                Upload foto kegiatan Anda telah divalidasi dan disetujui oleh
                Admin Pusat.
              </p>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1.5">
                <CiClock2 className="w-4 h-4" />
                Disetujui pada: {updatedAt}
              </p>
              {note !== "" && (
                <div className="mt-3 flex items-start gap-2 bg-green-100 rounded-lg px-3 py-2">
                  <FiMessageSquare className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800 italic">"{note}"</p>
                </div>
              )}
            </div>
          </Card.Content>
        </Card>
      ) : status === "REJECTED" ? (
        <Card className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <Card.Content className="flex flex-row items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <FiXCircle className="w-7 h-7 text-red-800" />
            </div>
            <div>
              <p className="font-bold text-red-800 text-lg">
                Pengajuan Ditolak
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                Upload foto kegiatan Anda tidak dapat disetujui. Harap perbaiki
                dan upload ulang.
              </p>
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
                <CiClock2 className="w-4 h-4" />
                Ditolak pada: {updatedAt}
              </p>
              {note !== "" && (
                <div className="mt-3 flex items-start gap-2 bg-red-100 rounded-lg px-3 py-2">
                  <FiMessageSquare className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 italic">"{note}"</p>
                </div>
              )}

              {canResubmit && (
                <Button
                  variant="danger"
                  className={"mt-3"}
                  onClick={() => {
                    router.push(`/pic/submit/${reportId}/edit`);
                  }}
                >
                  Upload Ulang
                </Button>
              )}
            </div>
          </Card.Content>
        </Card>
      ) : null}
    </div>
  );
}
