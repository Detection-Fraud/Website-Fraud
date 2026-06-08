import { ActivityReportItem } from "@/types/report.types";
import {
  Button,
  Card,
  Chip,
  Separator,
  Tooltip,
  useOverlayState,
} from "@heroui/react";
import Image from "next/image";
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
import { LuBuilding2, LuDot } from "react-icons/lu";
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
    picKegiatan,
    status,
    unit,
    notes,
    program,
    photos,
  } = report;

  const state = useOverlayState();

  console.log(
    "data photo",
    photos?.map((photo) => photo),
  );

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

  const getStatusConfig = (statusState: string) => {
    switch (statusState) {
      case "APPROVED":
        return {
          label: "Disetujui",
          bgColor: "bg-green-50/90 backdrop-blur-sm border-green-200/50",
          textColor: "text-green-600",
          dotColor: "bg-green-500",
        };
      case "REJECTED":
        return {
          label: "Ditolak",
          bgColor: "bg-red-50/90 backdrop-blur-sm border-red-200/50",
          textColor: "text-red-600",
          dotColor: "bg-red-500",
        };
      case "PENDING":
        return {
          label: "Pending",
          bgColor: "bg-yellow-50/90 backdrop-blur-sm border-yellow-200/50",
          textColor: "text-orange-600",
          dotColor: "bg-orange-500",
        };
    }
  };

  const statusConfig = getStatusConfig(status);

  const getParentRegion = () => {
    if (!unit) return "";
    return unit.name.replace(/Kanwil | Kancab /gi, "");
  };
  return (
    <Card className="p-0 rounded-2xl border border-slate-100 shadow-sm overflow-hidden ">
      <Card.Header>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative w-full aspect-4/3 overflow-hidden bg-slate-100">
            <CardCaraousel photos={photos} activityName={activityName} />

            <div className="absolute top-3.5 right-3.5 z-10">
              <Chip
                className={`shadow-sm ${statusConfig?.bgColor} ${statusConfig?.textColor}`}
                size="md"
              >
                <GoDotFill
                  className={`${statusConfig?.dotColor} rounded-full w-2 h-2`}
                />
                <Chip.Label className={`${statusConfig?.textColor}`}>
                  {statusConfig?.label}
                </Chip.Label>
              </Chip>
            </div>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="p-4 flex flex-col flex-1 gap-4">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">
            {activityName}
          </h3>
        </div>
        <div className="flex flex-col gap-3.5 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <FiCalendar className="text-sky-500 w-3.5 h-3.5 shrink-0" />
            <span className="truncate text-xs">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <FiMapPin className="text-sky-500 w-3.5 h-3.5 shrink-0" />
            <span className="truncate text-xs">{lokasi}</span>
          </div>
          <div className="flex items-center gap-2">
            <LuBuilding2 className="text-sky-500 w-3.5 h-3.5 shrink-0" />
            <Tooltip>
              <Tooltip.Trigger className="truncate text-xs">
                {unit?.name}
              </Tooltip.Trigger>
              <Tooltip.Content>
                <Tooltip.Arrow />
                {unit?.name}
              </Tooltip.Content>
            </Tooltip>
            <span className="bg-sky-50 text-sky-600 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 uppercase">
              {getParentRegion()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <FiUser className="text-sky-500 w-3.5 h-3.5 shrink-0" />
            <span className="truncate text-xs">{picKegiatan}</span>
          </div>
          <div className="flex items-center gap-2">
            <FiFolder className="text-sky-500 w-3.5 h-3.5 shrink-0" />
            <span className="truncate text-xs">{program?.name}</span>
          </div>

          {status === "REJECTED" && (
            <div>
              <div className="bg-red-50/90 border-l-4 p-1.5 rounded-xl border-red-400">
                <p className="text-red-500 text-xs font-semibold">
                  Catatan Admin:
                </p>
                <p className="text-xs text-slate-700">{notes}</p>
              </div>
            </div>
          )}
        </div>
      </Card.Content>

      <Card.Footer className="pb-5">
        <div className="w-full px-4 space-y-3">
          <Separator className="w-full my-2" />

          <div className="w-full flex gap-3">
            <Button
              className={"rounded-xl flex-1 shadow-sm"}
              variant="danger-soft"
              fullWidth
              onClick={onOpenModal}
              isDisabled={status !== "PENDING"}
            >
              <FiX />
              Reject
            </Button>
            <Button
              className={"rounded-xl flex-1 bg-green-400 shadow-sm"}
              fullWidth
              variant="primary"
              onClick={() => onApprove?.(id)}
              isDisabled={status !== "PENDING"}
            >
              <FiCheck />
              Approve
            </Button>
          </div>

          <Button
            fullWidth
            variant="outline"
            className={
              "bg-sky-100 text-sky-600 rounded-lg font-semibold text-xs"
            }
            onClick={onOpenLogs}
          >
            <FiEye />
            Lihat Log
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}
