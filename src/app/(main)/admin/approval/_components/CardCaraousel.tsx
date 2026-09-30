"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";
import { FiImage, FiMaximize2 } from "react-icons/fi";

interface CardCaraouselProps {
  photos?: { id: number; imageUrl: string; originalName: string }[];
  activityName: string;
  onPhotoClick?: (index: number) => void;
}

export default function CardCaraousel({
  photos,
  activityName,
  onPhotoClick,
}: CardCaraouselProps) {
  if (!photos || photos.length === 0) {
    return (
      <div className="relative w-full aspect-4/3 overflow-hidden bg-slate-100">
        <Image
          src={"/assets/images/404-error.png"}
          alt={activityName}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
          loading="lazy"
        />
      </div>
    );
  }

  if (photos.length === 1) {
    return (
      <div className="relative w-full aspect-4/3 overflow-hidden bg-slate-100 group/img">
        <button
          type="button"
          onClick={() => onPhotoClick?.(0)}
          className="relative w-full h-full block cursor-zoom-in text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset"
          aria-label={`Perbesar foto kegiatan: ${activityName}`}
        >
          <Image
            src={photos[0].imageUrl}
            alt={activityName}
            fill
            className="object-cover transition-transform duration-300 ease-out group-hover/img:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
            loading="lazy"
          />
          {/* Hover overlay with zoom affordance */}
          <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-xs font-semibold shadow-md transform translate-y-1 group-hover/img:translate-y-0 transition-transform duration-200">
              <FiMaximize2 className="w-3.5 h-3.5" />
              Perbesar
            </span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <Carousel className="w-full h-full group/carousel" opts={{ loop: true }}>
      <CarouselContent className="ml-0">
        {photos.map((photo, idx) => (
          <CarouselItem
            key={photo.id || idx}
            className="pl-0 relative w-full aspect-4/3 group/img"
          >
            <button
              type="button"
              onClick={() => onPhotoClick?.(idx)}
              className="relative w-full h-full block cursor-zoom-in text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset"
              aria-label={`Perbesar foto ${idx + 1} dari ${photos.length}: ${activityName}`}
            >
              <Image
                src={photo.imageUrl}
                alt={`${activityName} - Gambar ${idx + 1}`}
                fill
                className="object-cover transition-transform duration-300 ease-out group-hover/img:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
                loading="lazy"
              />
              {/* Hover overlay with zoom affordance */}
              <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-xs font-semibold shadow-md transform translate-y-1 group-hover/img:translate-y-0 transition-transform duration-200">
                  <FiMaximize2 className="w-3.5 h-3.5" />
                  Perbesar
                </span>
              </div>
            </button>

            {/* Photo counter indicator */}
            <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/70 backdrop-blur-md text-white text-[11px] font-medium shadow-xs">
              <FiImage className="w-3 h-3" />
              <span>{idx + 1}/{photos.length}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious
        onClick={(e) => e.stopPropagation()}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-8 sm:h-8 min-w-10 min-h-10 sm:min-w-8 sm:min-h-8 rounded-full border border-slate-200/50 bg-white/80 hover:bg-white text-slate-700 shadow-sm backdrop-blur-sm opacity-100 sm:opacity-0 sm:group-hover/carousel:opacity-100 transition-opacity duration-200 flex items-center justify-center p-0"
      />
      {/* Tombol Berikutnya (Melayang di kanan) */}
      <CarouselNext
        onClick={(e) => e.stopPropagation()}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-8 sm:h-8 min-w-10 min-h-10 sm:min-w-8 sm:min-h-8 rounded-full border border-slate-200/50 bg-white/80 hover:bg-white text-slate-700 shadow-sm backdrop-blur-sm opacity-100 sm:opacity-0 sm:group-hover/carousel:opacity-100 transition-opacity duration-200 flex items-center justify-center p-0"
      />
    </Carousel>
  );
}
