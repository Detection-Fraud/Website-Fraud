"use client";

import SafeImage from "@/components/ui/SafeImage";
import { ActivityReportItem } from "@/types/report.types";
import { Button, Modal } from "@heroui/react";
import { useEffect, useState } from "react";
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiExternalLink,
  FiFolder,
  FiMapPin,
  FiUser,
  FiX,
} from "react-icons/fi";
import { GoDotFill } from "react-icons/go";
import { LuBuilding2 } from "react-icons/lu";

interface ModalImagePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  report: ActivityReportItem | null;
  initialIndex?: number;
}

export default function ModalImagePreview({
  isOpen,
  onClose,
  report,
  initialIndex = 0,
}: ModalImagePreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Sync index whenever modal opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const photos = report?.photos || [];
  const totalPhotos = photos.length;
  const currentPhoto = photos[currentIndex] || photos[0];

  // Keyboard navigation: Left/Right arrows to flip photos, Escape to close
  useEffect(() => {
    if (!isOpen || totalPhotos <= 1) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalPhotos - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentIndex((prev) => (prev < totalPhotos - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, totalPhotos]);

  if (!report || totalPhotos === 0 || !currentPhoto) return null;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalPhotos - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < totalPhotos - 1 ? prev + 1 : 0));
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "foto-kegiatan.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Fallback: open image directly in a new tab if blob fetch is blocked
      window.open(imageUrl, "_blank");
    }
  };

  const formattedDate = report.tanggalKegiatan
    ? new Date(report.tanggalKegiatan).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <GoDotFill className="w-2.5 h-2.5 text-emerald-400" /> Disetujui
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <GoDotFill className="w-2.5 h-2.5 text-rose-400" /> Ditolak
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <GoDotFill className="w-2.5 h-2.5 text-amber-400 animate-pulse" /> Pending
          </span>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop
        variant="blur"
        className="bg-slate-950/85 backdrop-blur-md"
      >
        <Modal.Container size="cover" placement="center">
          <Modal.Dialog
            aria-label={`Preview foto kegiatan ${report.activityName}`}
            className="overflow-hidden rounded-2xl bg-slate-950 border border-white/10 p-0 text-white shadow-2xl max-w-5xl w-[calc(100%-2rem)] sm:w-full mx-auto my-auto flex flex-col max-h-[calc(100dvh-2rem)]"
          >
            {/* TOP HEADER */}
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 sm:px-6 py-3.5 bg-slate-900/80 backdrop-blur-sm shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg text-white leading-tight line-clamp-1">
                    {report.activityName}
                  </h3>
                  {renderStatusBadge(report.status)}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  {report.unit?.name && (
                    <span className="inline-flex items-center gap-1">
                      <LuBuilding2 className="w-3.5 h-3.5 text-slate-400" />
                      {report.unit.name.replace(/Kanwil | Kancab /gi, "")}
                    </span>
                  )}
                  {formattedDate && (
                    <span className="inline-flex items-center gap-1">
                      <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                      {formattedDate}
                    </span>
                  )}
                  {report.lokasi && (
                    <span className="hidden sm:inline-flex items-center gap-1 line-clamp-1">
                      <FiMapPin className="w-3.5 h-3.5 text-slate-400" />
                      {report.lokasi}
                    </span>
                  )}
                  {report.program?.name && (
                    <span className="hidden md:inline-flex items-center gap-1 text-blue-400 line-clamp-1">
                      <FiFolder className="w-3.5 h-3.5" />
                      {report.program.name}
                    </span>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS & CLOSE */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {totalPhotos > 1 && (
                  <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-white/10 text-xs font-medium text-slate-300 border border-white/10 tabular-nums">
                    {currentIndex + 1} / {totalPhotos}
                  </span>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Buka foto di tab baru"
                  className="min-h-10 px-2.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl"
                  onPress={() =>
                    window.open(currentPhoto.imageUrl, "_blank", "noopener,noreferrer")
                  }
                >
                  <FiExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-medium ml-1">
                    Buka Asli
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Unduh foto kegiatan"
                  className="min-h-10 px-2.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl"
                  onPress={() =>
                    handleDownload(
                      currentPhoto.imageUrl,
                      currentPhoto.originalName ||
                        `${report.activityName}-${currentIndex + 1}.jpg`,
                    )
                  }
                >
                  <FiDownload className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs font-medium ml-1">
                    Unduh
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  aria-label="Tutup preview foto"
                  className="min-h-10 min-w-10 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl ml-1"
                  onPress={onClose}
                >
                  <FiX className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* MAIN IMAGE VIEWPORT */}
            <div className="relative w-full h-[50vh] sm:h-[60vh] md:h-[65vh] flex items-center justify-center bg-slate-950 p-2 sm:p-4 select-none overflow-hidden">
              <SafeImage
                key={currentPhoto.imageUrl}
                fill
                src={currentPhoto.imageUrl}
                alt={`${report.activityName} - Foto ${currentIndex + 1}`}
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-contain transition-opacity duration-200"
                fallbackIconClassName="size-16 text-slate-700"
              />

              {/* FLOATING PREV / NEXT BUTTONS */}
              {totalPhotos > 1 && (
                <>
                  <Button
                    isIconOnly
                    aria-label="Foto sebelumnya"
                    variant="secondary"
                    onPress={handlePrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 min-h-11 min-w-11 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/15 backdrop-blur-md shadow-lg transition-transform active:scale-95 z-20"
                  >
                    <FiChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    isIconOnly
                    aria-label="Foto berikutnya"
                    variant="secondary"
                    onPress={handleNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 min-h-11 min-w-11 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/15 backdrop-blur-md shadow-lg transition-transform active:scale-95 z-20"
                  >
                    <FiChevronRight className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>

            {/* THUMBNAIL STRIP (if multiple photos) */}
            {totalPhotos > 1 && (
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900/90 border-t border-white/10 overflow-x-auto scrollbar-none shrink-0">
                {photos.map((photo, idx) => (
                  <button
                    key={photo.id || idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Pilih foto ${idx + 1} dari ${totalPhotos}`}
                    className={`relative aspect-4/3 w-14 sm:w-16 rounded-lg overflow-hidden shrink-0 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      idx === currentIndex
                        ? "ring-2 ring-blue-500 scale-105 opacity-100 shadow-md"
                        : "opacity-45 hover:opacity-85"
                    }`}
                  >
                    <SafeImage
                      fill
                      src={photo.imageUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      sizes="80px"
                      className="object-cover"
                      fallbackIconClassName="size-4 text-slate-500"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* FOOTER INFO BAR */}
            <div className="px-4 sm:px-6 py-3 border-t border-white/10 bg-slate-900/60 backdrop-blur-sm text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[11px] text-slate-300 truncate max-w-xs sm:max-w-md">
                  {currentPhoto.originalName || "Foto Kegiatan"}
                </span>
                {report.createdBy?.name && (
                  <span className="inline-flex items-center gap-1 text-slate-400 shrink-0">
                    <FiUser className="w-3.5 h-3.5 text-slate-500" />
                    {report.createdBy.name}
                  </span>
                )}
              </div>

              {/* Rejection Notes callout if rejected */}
              {report.status === "REJECTED" && report.notes && (
                <div className="w-full sm:w-auto text-rose-300 bg-rose-950/60 border border-rose-800/60 px-3 py-1.5 rounded-lg text-xs leading-relaxed">
                  <span className="font-semibold text-rose-400 mr-1.5">
                    Alasan Tolak:
                  </span>
                  {report.notes}
                </div>
              )}
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
