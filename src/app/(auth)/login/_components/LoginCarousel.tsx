"use client";

import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Banner } from "@/hooks/useBanners";
import { Card, Chip } from "@heroui/react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { PiStarFill, PiTrophyFill } from "react-icons/pi";

const CARD_HEIGHT = 440; // px — presisi untuk layout 2-kolom login desktop

interface LoginCarouselProps {
  banners: Banner[];
  variant?: "default" | "compact";
}

export default function LoginCarousel({ banners, variant = "default" }: LoginCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const activeBanners = (banners || []).filter((b) => b.isActive);
  const plugin = useRef(Autoplay({ delay: 4000, stopOnInteraction: false }));
  
  const isCompact = variant === "compact";
  const currentHeight = isCompact ? 160 : CARD_HEIGHT;

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  // Tidak ada banner aktif -> Tampilkan static branding card
  if (!activeBanners || activeBanners.length === 0) {
    return <StaticBrandingFallback />;
  }

  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden shadow-2xl shadow-black/60 group border border-white/10"
      style={{ height: currentHeight }}
    >
      <Carousel
        setApi={setApi}
        plugins={[plugin.current]}
        opts={{ loop: true, align: "start" }}
        className="w-full h-full"
        
      >
        <CarouselContent
          className="-ml-0 h-full"
          style={{ height: currentHeight }}
        >
          {activeBanners.map((banner: Banner) => (
            <CarouselItem
              key={banner.id}
              className="pl-0 relative w-full"
              style={{ height: currentHeight }}
            >
              {/* Foto Banner & Gradient Overlay */}
              <div className="relative w-full h-full bg-slate-950">
                <Image
                  src={banner.imageUrl}
                  alt={banner.name}
                  fill
                  className="object-cover object-center"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
              </div>

              {/* Badge PIC TERBAIK — kiri atas */}
              {!isCompact && (
                <div className="absolute top-5 left-5 z-10">
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
              )}

              {/* Badge Periode — kanan atas */}
              {!isCompact && banner.period && (
                <div className="absolute top-5 right-5 z-10">
                  <Chip className="bg-slate-900/80 backdrop-blur-md border border-white/20 px-3 py-1 font-bold text-xs text-white">
                    <PiStarFill className="text-amber-400 text-xs mr-1 shrink-0" />
                    <Chip.Label className="text-white text-[10px] font-extrabold uppercase">
                      {banner.period}
                    </Chip.Label>
                  </Chip>
                </div>
              )}

              {/* Metadata Info PIC — kiri bawah */}
              <div className="absolute bottom-12 left-5 right-5 text-white space-y-1.5 z-10">
                <h2 className={`${isCompact ? "text-lg" : "text-2xl"} font-extrabold tracking-tight leading-tight drop-shadow-md`}>
                  {banner.name}
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  {banner.role}
                </p>
                <p className="text-xs text-cyan-400 font-bold">{banner.unit}</p>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Dots Indicator — bottom center */}
      {count > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-1.5 z-20">
          {Array.from({ length: count }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => api?.scrollTo(idx)}
              className={`transition-all duration-300 rounded-full ${
                idx === current
                  ? "w-6 h-1.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Arrow Navigasi — hover reveal */}
      {count > 1 && (
        <>
          <div className="absolute inset-y-0 left-3 flex items-center z-20">
            <button
              onClick={() => api?.scrollPrev()}
              className="bg-slate-900/60 hover:bg-slate-900 border border-white/15 text-white rounded-full backdrop-blur-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center"
              aria-label="Previous slide"
            >
              <FiChevronLeft className="text-base" />
            </button>
          </div>
          <div className="absolute inset-y-0 right-3 flex items-center z-20">
            <button
              onClick={() => api?.scrollNext()}
              className="bg-slate-900/60 hover:bg-slate-900 border border-white/15 text-white rounded-full backdrop-blur-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center"
              aria-label="Next slide"
            >
              <FiChevronRight className="text-base" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StaticBrandingFallback() {
  return (
    <Card className="flex flex-col justify-center p-6 lg:p-8 rounded-[32px] bg-white/5 backdrop-blur-xl border border-white/10 w-full shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] text-white">
      <Card.Header className="w-full pb-0">
        <div className="flex items-center">
          <div className="bg-white/10 p-2 rounded-2xl backdrop-blur-sm border border-white/5">
            <Image
              src="/assets/images/logo-bulog-white.png"
              width={80}
              height={80}
              className="object-contain"
              alt="Logo Bulog"
            />
          </div>
          <div className="ml-5">
            <h1 className="text-2xl font-bold text-white drop-shadow-sm">
              DICE
            </h1>
            <h2 className="text-lg font-semibold text-blue-100 tracking-wide mt-1">
              Digital Culture &amp; Engagement Center
            </h2>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="pt-6">
        <div className="space-y-4">
          <div className="w-12 h-1 bg-blue-500/50 rounded-full mb-4" />
          <h3 className="text-2xl font-bold leading-snug text-white/90">
            Platform Aktivasi &amp; Monitoring Budaya Kerja
          </h3>
          <p className="text-blue-100/70 text-base leading-relaxed font-light">
            Sistem digital untuk monitoring, pelaporan, dan evaluasi kegiatan
            budaya kerja di seluruh unit kerja Perum BULOG.
          </p>
        </div>
      </Card.Content>
    </Card>
  );
}
