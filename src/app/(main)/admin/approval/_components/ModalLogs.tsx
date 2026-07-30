"use client";

import { useReportDetail } from "@/hooks/useReportDetail";
import { Button, CloseButton, Modal, Spinner } from "@heroui/react";
import { FiCheckCircle, FiRefreshCw, FiSend, FiXCircle } from "react-icons/fi";
import { IoTimeOutline } from "react-icons/io5";

interface LogEntry {
  id: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "RESUBMITTED";
  notes?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  createdAt?: string | Date;
}

interface ModalLogsProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  activityName: string;
}

const actionConfig = {
  SUBMITTED: {
    color: "text-blue-500",
    bg: "bg-blue-100",
    label: "Dokumen Disubmit",
    icon: FiSend,
  },
  APPROVED: {
    color: "text-green-500",
    bg: "bg-green-100",
    label: "Dokumen Disetujui",
    icon: FiCheckCircle,
  },
  REJECTED: {
    color: "text-red-500",
    bg: "bg-red-100",
    label: "Dokumen Ditolak",
    icon: FiXCircle,
  },
  RESUBMITTED: {
    color: "text-orange-500",
    bg: "bg-orange-100",
    label: "Dokumen Diajukan Ulang",
    icon: FiRefreshCw,
  },
};

export default function ModalLogs({
  isOpen,
  onClose,
  reportId,
  activityName,
}: ModalLogsProps) {
  const { report, loading } = useReportDetail(reportId);
  const logs = (report?.logs || []) as LogEntry[];

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md space-y-3">
            <Modal.CloseTrigger />
            <Modal.Header className="flex flex-row items-center">
              <Modal.Icon
                className="bg-sky-100 w-10 h-10
              rounded-lg"
              >
                <IoTimeOutline className="text-sky-600 w-6 h-6" />
              </Modal.Icon>
              <Modal.Heading>
                <div>
                  <p className="font-bold text-gray-900 text-lg">
                    Riwayat Aktivitas
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {activityName}
                  </p>
                </div>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="px-2 pb-4">
              {loading ? (
                <div className="flex justify-center items-center py-10 w-full">
                  <Spinner size="md" className="text-sky-500" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center text-slate-400 py-10 text-sm">
                  Belum ada riwayat aktivitas
                </div>
              ) : (
                <div className="relative border-l space-y-6 pb-2 mt-4 ml-3 border-slate-200">
                  {logs.map((log) => {
                    const config = actionConfig[log.action];
                    if (!config) return null;

                    const dateStr = new Date(log.createdAt || new Date())
                      .toLocaleString("id-ID", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                      .replace(/\.g/, ":")
                      .replace(/\//g, "-");

                    const Icon = config.icon;

                    return (
                      <div key={log.id} className="relative pl-6">
                        <span
                          className={`absolute -left-[17px] flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-white ${config.bg} ${config.color}`}
                        >
                          <Icon className="w-4.5 h-4.5" />
                        </span>

                        <div className="flex flex-col gap-0.5 -mt-0.5">
                          <p className="text-sm font-semibold text-slate-800">
                            {config.label}
                          </p>
                          <p className="text-xs text-slate-400">
                            {log.actorName || "Sistem"} (
                            {log.actorRole || "System"}) · {dateStr}
                          </p>
                          {/* Catatan Penolakan */}
                          {log.notes && log.action === "REJECTED" && (
                            <div className="mt-2 p-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs w-fit max-w-full">
                              <span className="font-semibold block mb-0.5">
                                Catatan Penolakan:
                              </span>
                              {log.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6">
                <Button
                  variant="outline"
                  className={"w-full rounded-xl"}
                  onClick={onClose}
                >
                  Tutup
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
