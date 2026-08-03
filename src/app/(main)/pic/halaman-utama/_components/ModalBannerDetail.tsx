"use client";

import { Button, Chip, Modal } from "@heroui/react";
import Image from "next/image";
import { FiCalendar, FiTarget } from "react-icons/fi";

export interface ProgramDetailData {
  id: string;
  name: string;
  frequency: number;
  description?: string | null;
  bannerUrl?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  category: {
    name: string;
    color: string | null;
    bannerUrl?: string | null;
    targetUnit: string;
  } | null;
}

interface ModalBannerDetailProps {
  program: ProgramDetailData;
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalBannerDetail({
  program,
  isOpen,
  onClose,
  onOpenChange,
}: ModalBannerDetailProps & { onOpenChange?: (isOpen: boolean) => void }) {
  if (!program) return null;

  const cat = program.category;
  const bannerUrl = program.bannerUrl ?? cat?.bannerUrl;
  const themeColor = cat?.color ?? "#3B82F6";

  const formatDate = (dateInput: string | Date) => {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(dateInput));
    } catch {
      return String(dateInput);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop variant="blur" isOpen={isOpen} onOpenChange={onOpenChange ?? onClose}>
        <Modal.Container size="lg">
          <Modal.Dialog className="overflow-hidden rounded-2xl p-0 bg-white shadow-2xl">
            <Modal.CloseTrigger className="z-30 text-white bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full p-2 top-3 right-3" />

            <div className="relative w-full aspect-2/1 bg-slate-900 overflow-hidden">
              {bannerUrl ? (
                <Image
                  src={bannerUrl}
                  alt={program.name}
                  className="w-full h-full object-cover object-center"
                  width={800}
                  height={500}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center p-6 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${themeColor}e6, ${themeColor}66)`,
                  }}
                >
                  <span className="text-white text-2xl font-black tracking-tight">
                    {cat?.name ?? program.name}
                  </span>
                </div>
              )}

              <div className="absolute inset-0 bg-linear-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-3 left-4 flex items-center gap-2">
                <Chip
                  size="sm"
                  className="bg-white/20 backdrop-blur-md border border-white/20 text-white"
                >
                  <Chip.Label className="font-bold tracking-wider uppercase text-xs text-white">
                    {cat?.name ?? "Umum"}
                  </Chip.Label>
                </Chip>
              </div>
            </div>

            {/* MODAL HEADER & BODY */}
            <Modal.Header className="px-6 pt-5 pb-0">
              <Modal.Heading className="text-xl font-bold text-slate-900 leading-tight">
                {program.name}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="px-6 py-4 space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 font-medium">
                  <FiCalendar className="w-4 h-4 text-slate-400" />
                  <span>
                    {formatDate(program.startDate)} -{" "}
                    {formatDate(program.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <FiTarget className="w-4 h-4 text-slate-400" />
                  <span>Target: {program.frequency}x Kegiatan</span>
                </div>
              </div>

              {/* full desc */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Deskripsi Program
                </span>
                {program.description ? (
                  <div
                    className="pl-3.5 border-l-3 max-h-48 overflow-y-auto text-sm text-slate-700 leading-relaxed space-y-2"
                    style={{ borderColor: themeColor }}
                  >
                    <p className="whitespace-pre-line">{program.description}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Tidak ada deskripsi rinci untuk program ini.
                  </p>
                )}
              </div>
            </Modal.Body>

            {/* 3. Modal Footer */}
            <Modal.Footer className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <Button
                slot="close"
                variant="outline"
                size="sm"
                onPress={onClose}
              >
                Tutup
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
