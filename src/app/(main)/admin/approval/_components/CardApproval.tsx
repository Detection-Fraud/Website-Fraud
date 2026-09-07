import { ActivityReportItem } from "@/types/report.types";
import { Button, Card, Chip, Modal, Separator, Tooltip } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import {
  FiCalendar,
  FiCheck,
  FiEdit3,
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
  onApprove?: (id: string, trigger: HTMLButtonElement) => void;
  onOpenModal?: () => void;
  onOpenLogs?: () => void;
  onOpenScore?: (id: string, trigger: HTMLButtonElement) => void;
}

export default function CardApproval({
  report,
  onApprove,
  onOpenModal,
  onOpenLogs,
  onOpenScore,
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

  const descriptionText = report.description.trim();
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);
  const descriptionPreviewRef = useRef<HTMLParagraphElement>(null);
  const descriptionTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const preview = descriptionPreviewRef.current;
    if (!descriptionText || !preview) {
      setIsDescriptionTruncated(false);
      return;
    }

    const measureOverflow = () => {
      setIsDescriptionTruncated(preview.scrollHeight > preview.clientHeight + 1);
    };
    const frame = window.requestAnimationFrame(measureOverflow);
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(preview);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [descriptionText]);

  const handleDescriptionModalChange = (isOpen: boolean) => {
    setIsDescriptionModalOpen(isOpen);
    if (!isOpen) {
      window.requestAnimationFrame(() => descriptionTriggerRef.current?.focus());
    }
  };

  const formattedDate = new Date(tanggalKegiatan).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const getStatusConfig = (statusState: string) => {
    switch (statusState) {
      case "APPROVED":
        return {
          label: "Disetujui",
          bgColor:
            "bg-emerald-50/90 backdrop-blur-md border border-emerald-200/60",
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

  const isDirectAdminApproved =
    status === "APPROVED" &&
    program?.category?.targetUnit === "PARTISIPASI_PERSEN" &&
    program.category.evidenceMode === "PHOTO_WITHOUT_AI" &&
    program.category.scoreInputMode === "DIRECT_ADMIN";

  const getParentRegion = () => {
    if (!unit) return "";
    return unit.name.replace(/Kanwil | Kancab /gi, "");
  };

  return (
    <>
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
                  <div className="flex items-center gap-1.5 px-0.5">
                    <GoDotFill
                      className={`w-2.5 h-2.5 ${statusConfig?.dotColor} ${status === "PENDING" ? "animate-pulse" : ""}`}
                    />
                    <Chip.Label className="text-xs font-semibold">
                      {statusConfig?.label}
                    </Chip.Label>
                  </div>
                </Chip>
              </div>
            </div>
          </div>
        </Card.Header>

        <Card.Content className="p-5 flex flex-col gap-4">
          <div className="space-y-1">
            <Tooltip delay={0}>
              <Tooltip.Trigger className="w-full text-left cursor-default">
                <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-1">
                  {activityName}
                </h3>
              </Tooltip.Trigger>
              <Tooltip.Content showArrow placement="top">
                <Tooltip.Arrow />
                {activityName}
              </Tooltip.Content>
            </Tooltip>
            {program && (
              <div className="flex items-center gap-1.5 text-xs text-blue-800 font-medium">
                <FiFolder className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span className="line-clamp-1">{program.name}</span>
              </div>
            )}
            {descriptionText && (
              <div className="mt-2 border-l-[3px] border-[var(--brand-navy-600)] bg-[var(--brand-navy-50)] px-3 py-2.5 rounded-r-xl">
                <p className="text-[11px] font-bold leading-4 text-[color:var(--brand-navy-900)]">
                  Deskripsi kegiatan
                </p>
                <p
                  ref={descriptionPreviewRef}
                  className="mt-0.5 line-clamp-2 whitespace-pre-line break-words text-xs leading-relaxed text-slate-700"
                >
                  {descriptionText}
                </p>
                {isDescriptionTruncated && (
                  <Button
                    ref={descriptionTriggerRef}
                    variant="ghost"
                    size="sm"
                    aria-label={`Baca deskripsi kegiatan lengkap untuk ${activityName}`}
                    className="-ml-2 mt-1 min-h-11 px-2 text-xs font-semibold text-[color:var(--brand-navy-800)] hover:bg-blue-100/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] active:scale-[0.98]"
                    onPress={() => setIsDescriptionModalOpen(true)}
                  >
                    Baca selengkapnya
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <LuBuilding2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="font-semibold text-slate-800">
                {getParentRegion()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <FiCalendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{formattedDate}</span>
            </div>

            <div className="flex items-center gap-2">
              <FiMapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="line-clamp-1">{lokasi}</span>
            </div>

            <div className="flex items-center gap-2">
              <FiUser className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="line-clamp-1">
                {createdBy?.name || "Petugas Tidak Dikenal"}
              </span>
            </div>

            {status === "REJECTED" && notes && (
              <div className="mt-1">
                <div className="bg-rose-50/90 border-l-3 border-rose-500 p-2.5 rounded-r-xl">
                  <p className="text-rose-700 text-xs font-bold mb-0.5">
                    Catatan Admin:
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {notes}
                  </p>
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

          {isDirectAdminApproved && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <FiEdit3 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">
                    Penilaian partisipasi
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    Kelola persentase partisipasi untuk laporan yang telah
                    disetujui.
                  </p>
                </div>
              </div>
              <Button
                fullWidth
                variant="outline"
                aria-label={`Kelola nilai partisipasi untuk ${activityName}`}
                className="mt-3 min-h-11 rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold text-xs shadow-xs active:scale-[0.98] transition-all"
                onPress={(event) =>
                  onOpenScore?.(id, event.target as HTMLButtonElement)
                }
              >
                <FiEdit3 className="h-3.5 w-3.5" aria-hidden="true" />
                Kelola Nilai
              </Button>
            </div>
          )}

          {!isDirectAdminApproved && (
            <div className="w-full flex gap-2.5">
              <Button
                className="rounded-xl flex-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60 font-semibold text-xs shadow-xs active:scale-[0.98] transition-all"
                fullWidth
                onPress={onOpenModal}
                isDisabled={status !== "PENDING"}
              >
                <FiX className="w-3.5 h-3.5" aria-hidden="true" />
                Tolak
              </Button>

              <Button
                className="rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs active:scale-[0.98] transition-all"
                fullWidth
                onPress={(event) =>
                  onApprove?.(id, event.target as HTMLButtonElement)
                }
                isDisabled={status !== "PENDING"}
              >
                <FiCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Approve
              </Button>
            </div>
          )}

          {/* UPDATED: Sky Soft View Logs Button */}
          <Button
            fullWidth
            variant="outline"
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl font-semibold text-xs transition-all active:scale-[0.98]"
            onPress={onOpenLogs}
          >
            <FiEye className="w-3.5 h-3.5 text-slate-500" />
            Lihat Log
          </Button>
        </div>
      </Card.Footer>
      </Card>
      <Modal
        isOpen={isDescriptionModalOpen}
        onOpenChange={handleDescriptionModalChange}
      >
        <Modal.Backdrop>
          <Modal.Container scroll="inside">
            <Modal.Dialog
              aria-labelledby="description-modal-heading"
              aria-describedby="description-modal-body"
              className="max-h-[calc(100dvh-2rem)] rounded-2xl border border-slate-200/60 bg-white shadow-xl sm:max-w-xl"
            >
              <Modal.CloseTrigger aria-label="Tutup deskripsi kegiatan">
                <FiX aria-hidden="true" />
              </Modal.CloseTrigger>
              <Modal.Header>
                <Modal.Heading id="description-modal-heading">
                  Deskripsi kegiatan
                </Modal.Heading>
                <p className="text-xs text-slate-500">{activityName}</p>
              </Modal.Header>
              <Modal.Body id="description-modal-body">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                  {descriptionText}
                </p>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
