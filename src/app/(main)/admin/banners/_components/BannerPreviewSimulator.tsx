"use client";

import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Banner } from "@/hooks/useBanners";
import { Button, Chip } from "@heroui/react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  PiImage,
  PiPause,
  PiPlay,
  PiStarFill,
  PiTrophyFill,
} from "react-icons/pi";

interface BannerPreviewSimulatorProps {
  banners: Banner[];
}

export default function BannerPreviewSimulator({
  banners,
}: BannerPreviewSimulatorProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const activeBanners = (banners || []).filter((b) => b.isActive);
  const autoplayRef = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false }),
  );

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const toggleAutoplay = () => {
    const autoplay = autoplayRef.current;
    if (!autoplay) return;

    if (isPlaying) {
      autoplay.stop();
      setIsPlaying(false);
    } else {
      autoplay.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-4 md:p-6 text-white shadow-xl border border-slate-800 space-y-4">
      {/* HEADER ROW */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
          <span className="text-xs font-semibold text-slate-400 ml-2 tracking-wider uppercase">
            Live Login Carousel Simulator
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">
            {activeBanners.length} Banner Aktif
          </span>
          {activeBanners.length > 1 && (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className={"text-slate-400 hover:text-white w-7 h-7 min-w-0"}
              onPress={toggleAutoplay}
            >
              {isPlaying ? (
                <PiPause className="w-4 h-4" />
              ) : (
                <PiPlay className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main Display */}
      <div className="relative w-full h-[320px] md:h-[380px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 group">
        {activeBanners.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 p-6 text-center">
            <PiImage className="w-12 h-12 text-slate-700" />
            <p className="font-semibold text-slate-400">
              Tidak Ada Banner Aktif
            </p>
            <p className="text-xs text-slate-600 max-w-sm">
              Aktifkan minimal satu banner pada daftar di bawah agar tayang
              pada carousel halaman login.
            </p>
          </div>
        ) : (
          <Carousel
            setApi={setApi}
            plugins={[autoplayRef.current]}
            opts={{ loop: true, align: "start" }}
            className="w-full h-full"
          >
            <CarouselContent className="-ml-0 h-[320px] md:h-[380px]">
              {activeBanners.map((banner) => (
                <CarouselItem
                  key={banner.id}
                  className="pl-0 relative w-full h-full"
                >
                  {/* Image & Gradient Overlay */}
                  <div className="relative w-full h-full">
                    {banner.imageUrl && (
                      <Image
                        src={banner.imageUrl}
                        alt={banner.name}
                        fill
                        className="object-cover object-center"
                        priority
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
                  </div>

                  {/* Badge Status Best PIC */}
                  <div className="absolute top-4 left-4 z-10">
                    <Chip
                      color="warning"
                      variant="primary"
                      size="sm"
                      className="shadow-lg"
                    >
                      <PiTrophyFill className="text-white text-xs mr-1" />
                      <Chip.Label className="text-white text-[10px] font-extrabold tracking-wider">
                        PIC TERBAIK
                      </Chip.Label>
                    </Chip>
                  </div>

                  {/* Badge Periode */}
                  {banner.period && (
                    <div className="absolute top-4 right-4 z-10">
                      <Chip className="bg-slate-900/80 backdrop-blur-md border border-white/20 px-3 py-1 font-bold text-xs text-white">
                        <PiStarFill className="text-amber-400 text-xs mr-1 shrink-0" />
                        <Chip.Label className="text-white text-[10px] font-extrabold uppercase">
                          {banner.period}
                        </Chip.Label>
                      </Chip>
                    </div>
                  )}

                  {/* Metadata Content */}
                  <div className="absolute bottom-5 left-5 right-5 z-10 space-y-1">
                    <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight drop-shadow-md">
                      {banner.name}
                    </h3>
                    <p className="text-xs text-slate-300 font-medium">
                      {banner.role}
                    </p>
                    <p className="text-xs text-cyan-400 font-bold">
                      {banner.unit}
                    </p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* Navigation Arrows */}
            {count > 1 && (
              <>
                <button
                  onClick={() => api?.scrollPrev()}
                  aria-label="Banner sebelumnya"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300"
                >
                  <FiChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => api?.scrollNext()}
                  aria-label="Banner berikutnya"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300"
                >
                  <FiChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </Carousel>
        )}
      </div>

      {/* Dot Indicators */}
      {count > 1 && (
        <div className="flex justify-center items-center gap-1.5 pt-1">
          {Array.from({ length: count }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => api?.scrollTo(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`transition-all duration-300 rounded-full ${
                idx === current
                  ? "w-7 h-1.5 bg-blue-500"
                  : "w-1.5 h-1.5 bg-slate-700 hover:bg-slate-500"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
