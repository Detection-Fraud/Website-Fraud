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
import {
  PiArrowLeft,
  PiArrowRight,
  PiStarFill,
  PiTrophyFill,
} from "react-icons/pi";

const CARD_HEIGHT = 480; // px — tinggi card carousel

interface LoginCarouselProps {
  banners: Banner[];
}

export default function LoginCarousel({ banners }: LoginCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const plugin = useRef(Autoplay({ delay: 4000, stopOnInteraction: false }));

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  // Tidak ada banner → tampilkan static branding card
  if (!banners || banners.length === 0) {
    return <StaticBrandingFallback />;
  }

  return (
    /* Card wrapper — rounded, shadow, overflow hidden */
    <div
      className="relative w-full rounded-3xl overflow-hidden shadow-2xl shadow-black/50 group border border-white/10"
      style={{ height: CARD_HEIGHT }}
    >
      <Carousel
        setApi={setApi}
        plugins={[plugin.current]}
        opts={{ loop: true, align: "start" }}
        className="w-full h-full"
      >
        <CarouselContent
          className="-ml-0 h-full"
          style={{ height: CARD_HEIGHT }}
        >
          {banners.map((banner: Banner) => (
            <CarouselItem
              key={banner.id}
              className="pl-0 relative w-full"
              style={{ height: CARD_HEIGHT }}
            >
              {/* Foto */}
              <div className="relative w-full h-full">
                <Image
                  src={banner.imageUrl}
                  alt={banner.name}
                  fill
                  className="object-cover object-center"
                  priority
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
              </div>

              {/* Badge PIC TERBAIK — kiri atas */}
              <div className="absolute top-5 left-5">
                <Chip color="warning" variant="primary">
                  <PiTrophyFill className="text-white text-sm" />
                  <Chip.Label className="text-white">PIC TERBAIK</Chip.Label>
                </Chip>
              </div>

              {/* Badge Periode — kanan atas */}
              <div className="absolute top-5 right-5">
                <Chip className="bg-slate-900/60 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full flex items-center gap-1.5 font-bold text-xs text-white">
                  <PiStarFill className="text-amber-400 text-sm" />
                  <Chip.Label>{banner.period}</Chip.Label>
                </Chip>
              </div>

              {/* Info nama + role bawah */}
              <div className="absolute bottom-14 left-5 right-5 text-white space-y-3">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight leading-tight drop-shadow-md">
                    {banner.name}
                  </h2>
                  <p className="text-sm text-blue-100/80 font-medium mt-0.5">
                    {banner.role}
                  </p>
                  <p className="text-xs text-cyan-400 font-bold mt-1">
                    {banner.unit}
                  </p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Dots indicator — kiri bawah */}
      <div className="absolute bottom-5 left-5 flex items-center gap-1.5 z-20">
        {Array.from({ length: count }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => api?.scrollTo(idx)}
            className={`transition-all duration-300 rounded-full ${
              idx === current
                ? "w-5 h-1.5 bg-white"
                : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Arrow navigasi — muncul saat hover */}
      <div className="absolute inset-y-0 left-3 flex items-center z-20">
        <button
          onClick={() => api?.scrollPrev()}
          className="bg-white/10 hover:bg-white/25 border border-white/15 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-8 h-8 flex items-center justify-center"
          aria-label="Previous slide"
        >
          <PiArrowLeft className="text-sm" />
        </button>
      </div>
      <div className="absolute inset-y-0 right-3 flex items-center z-20">
        <button
          onClick={() => api?.scrollNext()}
          className="bg-white/10 hover:bg-white/25 border border-white/15 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-8 h-8 flex items-center justify-center"
          aria-label="Next slide"
        >
          <PiArrowRight className="text-sm" />
        </button>
      </div>
    </div>
  );
}

/**
 * Ditampilkan saat tidak ada banner aktif dari CMS.
 * Tetap menjaga layout 2-kolom dengan branding DICE.
 */
function StaticBrandingFallback() {
  return (
    <div className="flex items-center justify-center w-full">
      <Card
        className="flex flex-col justify-center p-6 lg:p-8 rounded-[32px]
            bg-white/5 backdrop-blur-xl border border-white/10 w-full
            shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]"
      >
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
            <div className="w-12 h-1 bg-blue-500/50 rounded-full mb-4"></div>
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
    </div>
  );
}
