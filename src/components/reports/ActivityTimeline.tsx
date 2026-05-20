import { Card } from "@heroui/react";
import {
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiSend,
  FiXCircle,
} from "react-icons/fi";

interface LogEntry {
  id: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "RESUBMITTED";
  notes?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  createdAt?: string | Date;
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
export default function ActivityTimeline({ logs = [] }: { logs?: LogEntry[] }) {
  if (!logs || logs.length === 0) {
    return (
      <Card>
        <Card.Header className="flex flex-row gap-2 items-center mb-4">
          <div className="w-9 h-9 bg-[#e0f2fe] flex  rounded-xl items-center justify-center">
            <FiClock className="text-[#0284c7] w-5 h-5" />
          </div>
          <Card.Title className="text-md font-bold text-[#1E293B]">
            Activity Log
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="text-center text-gray-500 py-4">No activity</div>
        </Card.Content>
      </Card>
    );
  }
  return (
    <Card className="rounded-2xl shadow-md border-slate-200 border">
      <Card.Header className="flex flex-row gap-2 items-center">
        <div className="w-9 h-9 bg-[#e0f2fe] flex  rounded-xl items-center justify-center">
          <FiClock className="text-[#0284c7] w-5 h-5" />
        </div>
        <Card.Title className="text-md font-bold text-[#1E293B]">
          Activity Log
        </Card.Title>
      </Card.Header>

      <Card.Content className="px-6 py-3 overflow-hidden">
        <div className="relative border-l space-y-8 pb-4 mt-2 border-gray-200">
          {logs.map((log) => {
            const config = actionConfig[log.action];
            const dateStr = new Date(log.createdAt || new Date())
              .toLocaleString("id-ID", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
              .replace(/\./g, ":")
              .replace(/\//g, "-");
            // Format disesuaikan mendekati YYYY-MM-DD HH:mm

            const Icon = config.icon;

            return (
              <div key={log.id} className="relative pl-8">
                {/* Lingkaran Ikon */}
                <span
                  className={`absolute -left-[17px] flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-white ${config.bg} ${config.color}`}
                >
                  <Icon className="w-4 h-4" />
                </span>

                {/* Konten Timeline */}
                <div className="flex flex-col gap-1 -mt-1">
                  <p className="text-sm font-semibold text-[#1e293b]">
                    {config.label}
                  </p>
                  <p className="text-xs text-gray-400">
                    {log.actorName || "Sistem"} · {dateStr}
                  </p>

                  {/* Kotak Notes (khusus ditolak) */}
                  {log.notes && log.action === "REJECTED" && (
                    <div className="mt-3 p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs w-fit max-w-full">
                      {log.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card.Content>
    </Card>
  );
}
