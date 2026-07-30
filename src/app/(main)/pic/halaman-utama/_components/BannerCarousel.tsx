"use client";
import { Chip, useOverlayState } from "@heroui/react";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import { FiInfo } from "react-icons/fi";
import ModalBannerDetail from "./ModalBannerDetail";

interface Program {
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

interface BannerCarouselProps {
  programs: Program[];
}

export default function BannerCarousel({ programs }: BannerCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
    },
    [Autoplay({ delay: 5000, stopOnInteraction: false })],
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalState = useOverlayState();
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

  const handleOpenDetail = (prog: Program) => {
    setSelectedProgram(prog);
    modalState.open();
  };

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback(
    (index: number) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi],
  );

  if (programs.length === 0) {
    return (
      <div className="w-full h-full min-h-75 bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
        Tidak ada program aktif saat ini
      </div>
    );
  }

  return (
    <div
      className="relative w-full group overflow-hidden rounded-xl"
      ref={emblaRef}
    >
      <div className="flex w-full h-full">
        {programs.map((prog, idx) => {
          const cat = prog.category;
          const fallbackColor = cat?.color ?? "#0f172a";

          return (
            <div
              key={prog.id}
              className="relative flex-[0_0_100%] min-w-0 w-full aspect-[2.5/1] min-h-60 max-h-96 rounded-xl overflow-hidden cursor-pointer group/slide"
              onClick={() => handleOpenDetail(prog)}
            >
              <div className="absolute inset-0 w-full h-full">
                {cat?.bannerUrl ? (
                  <img
                    src={cat.bannerUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover object-center z-0 block"
                  />
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center p-8 text-center"
                    style={{
                      background: `linear-gradient(135deg, ${fallbackColor}e6, ${fallbackColor}99)`,
                    }}
                  >
                    <div className="text-white text-4xl font-black tracking-tighter drop-shadow-md">
                      {cat?.name ?? prog.name}
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute inset-0 bg-linear-to-t from-slate-900/90 via-slate-900/20 to-transparent z-10" />

              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col justify-end z-20">
                <div className="inline-flex items-center gap-2 mb-3">
                  <Chip
                    size="sm"
                    className="bg-white/20 backdrop-blur-md border border-white/20"
                  >
                    <Chip.Label className="font-bold tracking-widest uppercase text-white">
                      {cat?.name ?? "Umum"}
                    </Chip.Label>
                  </Chip>
                  <span className="text-white/80 text-xs font-medium tracking-wide">
                    Target: {prog.frequency}x Kegiatan
                  </span>
                  <span className="ml-auto text-white/90 text-xs font-semibold flex items-center gap-1 opacity-0 group-hover/slide:opacity-100 transition-opacity bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-md">
                    <FiInfo className="w-3.5 h-3.5" /> Detail
                  </span>
                </div>
                <h2 className="text-white font-bold text-2xl md:text-3xl leading-tight max-w-[45ch]">
                  {prog.name}
                </h2>
                {prog.description && (
                  <p className="text-white/80 text-sm line-clamp-2 max-w-[60ch] mt-1.5 font-normal">
                    {prog.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {programs.length > 1 && (
        <div className="absolute bottom-6 right-8 flex gap-2 z-30">
          {programs.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`h-1.5 transition-all duration-300 rounded-full ${
                i === selectedIndex
                  ? "w-8 bg-white"
                  : "w-2 bg-white/40 hover:bg-white/80"
              }`}
              aria-label={`Lihat banner ${i + 1}`}
            />
          ))}
        </div>
      )}

      {selectedProgram && (
        <ModalBannerDetail
          program={selectedProgram}
          isOpen={modalState.isOpen}
          onClose={modalState.close}
          onOpenChange={modalState.setOpen}
        />
      )}
    </div>
  );
}
