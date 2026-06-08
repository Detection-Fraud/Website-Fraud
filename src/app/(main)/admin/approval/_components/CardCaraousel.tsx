"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Image from "next/image";

interface CardCaraouselProps {
  photos?: { id: number; imageUrl: string; originalName: string }[];
  activityName: string;
}
export default function CardCaraousel({
  photos,
  activityName,
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
      <div className="relative w-full aspect-4/3 overflow-hidden bg-slate-100">
        <Image
          src={photos[0].imageUrl}
          alt={activityName}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <Carousel className="w-full h-full group/carousel" opts={{ loop: true }}>
      <CarouselContent className="ml-0">
        {photos.map((photo, idx) => (
          <CarouselItem
            key={photo.id || idx}
            className="pl-0 relative w-full aspect-4/3"
          >
            <Image
              src={photo.imageUrl}
              alt={`${activityName} - Gambar ${idx + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
              loading="lazy"
            />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 min-w-8 min-h-8 rounded-full border border-slate-200/50 bg-white/80 hover:bg-white text-slate-700 shadow-sm backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 flex items-center justify-center p-0" />
      {/* Tombol Berikutnya (Melayang di kanan) */}
      <CarouselNext className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 min-w-8 min-h-8 rounded-full border border-slate-200/50 bg-white/80 hover:bg-white text-slate-700 shadow-sm backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 flex items-center justify-center p-0" />
    </Carousel>
  );
}
