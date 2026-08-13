import { ActivityReportItem } from "@/types/report.types";
import {
  Button,
  Card,
  Chip,
  Separator,
  Tooltip,
  useOverlayState,
} from "@heroui/react";
import {
  FiCalendar,
  FiCheck,
  FiEye,
  FiFolder,
  FiMapPin,
  FiUser,
  FiX,
} from "react-icons/fi";
import { GoDotFill } from "react-icons/go";
import { LuBuilding2 } from "react-icons/lu";
import CardCaraousel from "./CardCaraousel";

interface CardApprovalProps {
  report: ActivityReportItem;
  onApprove?: (id: string) => void;
  onOpenModal?: () => void;
  onOpenLogs?: () => void;
}

export default function CardApproval({
  report,
  onApprove,
  onOpenModal,
  onOpenLogs,
}: CardApprovalProps) {
  const {
    id,
    activityName,
    tanggalKegiatan,
    lokasi,
    status,
    unit,
    notes,
    program,
    createdBy,
    photos,
  } = report;

  const state = useOverlayState();

  const coverImage =
    photos && photos.length > 0
      ? photos[0].imageUrl
      : "/placeholder-ativity.jpg";

  const formattedDate = new Date(tanggalKegiatan)
    .toLocaleDateString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/")
    .reverse()
    .join("-");

  // UPDATED: Calibrated Status Chips (Amber for PENDING, Emerald for APPROVED, Rose for REJECTED)
  const getStatusConfig = (statusState: string) => {
    switch (statusState) {
      case "APPROVED":
        return {
          label: "Disetujui",
          bgColor: "bg-emerald-50/90 backdrop-blur-md border border-emerald-200/60",
          textColor: "text-emerald-700 font-semibold",
          dotColor: "bg-emerald-500",
        };
      case "REJECTED":
        return {
          label: "Ditolak",
          bgColor: "bg-rose-50/90 backdrop-blur-md border border-rose-200/60",
          textColor: "text-rose-700 font-semibold",
          dotColor: "bg-rose-500",
        };
      case "PENDING":
      default:
        return {
          label: "Pending",
          bgColor: "bg-amber-50/90 backdrop-blur-md border border-amber-200/60",
          textColor: "text-amber-700 font-semibold",
          dotColor: "bg-amber-500",
        };
    }
  };

  const statusConfig = getStatusConfig(status);

  const getParentRegion = () => {
    if (!unit) return "";
    return unit.name.replace(/Kanwil | Kancab /gi, "");
  };

  return (
    <Card className="p-0 rounded-2xl border border-slate-200/60 shadow-surface hover:shadow-surface-md transition-all duration-200 bg-white overflow-hidden flex flex-col justify-between h-full">
      <div>
        <Card.Header className="p-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative w-full aspect-4/3 overflow-hidden bg-slate-100">
              <CardCaraousel photos={photos} activityName={activityName} />

              <div className="absolute top-3.5 right-3.5 z-10">
                <Chip
                  className={`shadow-xs ${statusConfig?.bgColor} ${statusConfig?.textColor}`}
                  size="md"
                >
                  <GoDotFill
                    className={`${statusConfig?.dotColor} rounded-full w-2 h-2`}
                  />
                  <Chip.Label className={`${statusConfig?.textColor} text-xs`}>
                    {statusConfig?.label}
                  </Chip.Label>
                </Chip>
              </div>
            </div>
          </div>
        </Card.Header>

        <Card.Content className="p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
              {activityName}
            </h3>
          </div>
          
          {/* UPDATED: Slate Metadata List */}
          <div className="flex flex-col gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <FiCalendar className="text-slate-400 w-3.5 h-3.5 shrink-0" />
              <span className="truncate tabular-nums font-medium text-slate-700">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiMapPin className="text-slate-400 w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-medium text-slate-700">{lokasi}</span>
            </div>
            <div className="flex items-center gap-2">
              <LuBuilding2 className="text-slate-400 w-3.5 h-3.5 shrink-0" />
              <Tooltip>
                <Tooltip.Trigger className="truncate font-semibold text-slate-800">
                  {unit?.name}
                </Tooltip.Trigger>
                <Tooltip.Content>
                  <Tooltip.Arrow />
                  {unit?.name}
                </Tooltip.Content>
              </Tooltip>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 uppercase border border-slate-200/60">
                {getParentRegion()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <FiUser className="text-slate-400 w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-medium text-slate-700">{createdBy?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiFolder className="text-slate-400 w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">{program?.name}</span>
            </div>

            {status === "REJECTED" && notes && (
              <div className="mt-1">
                <div className="bg-rose-50/90 border-l-3 border-rose-500 p-2.5 rounded-r-xl">
                  <p className="text-rose-700 text-xs font-bold mb-0.5">
                    Catatan Admin:
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{notes}</p>
                </div>
              </div>
            )}
          </div>
        </Card.Content>
      </div>

      {/* UPDATED: High-Contrast Footer Buttons */}
      <Card.Footer className="pb-5 pt-0 px-5">
        <div className="w-full space-y-3">
          <Separator className="w-full bg-slate-100 my-1" />

          <div className="w-full flex gap-2.5">
            {/* UPDATED: Soft Rose Reject Button */}
            <Button
              className="rounded-xl flex-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60 font-semibold text-xs shadow-xs active:scale-[0.98] transition-all"
              fullWidth
              onClick={onOpenModal}
              isDisabled={status !== "PENDING"}
            >
              <FiX className="w-3.5 h-3.5" />
              Reject
            </Button>
            
            {/* UPDATED: High-Contrast Emerald Approve Button */}
            <Button
              className="rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs active:scale-[0.98] transition-all"
              fullWidth
              onClick={() => onApprove?.(id)}
              isDisabled={status !== "PENDING"}
            >
              <FiCheck className="w-3.5 h-3.5" />
              Approve
            </Button>
          </div>

          {/* UPDATED: Sky Soft View Logs Button */}
          <Button
            fullWidth
            variant="outline"
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl font-semibold text-xs transition-all active:scale-[0.98]"
            onClick={onOpenLogs}
          >
            <FiEye className="w-3.5 h-3.5 text-slate-500" />
            Lihat Log
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}
