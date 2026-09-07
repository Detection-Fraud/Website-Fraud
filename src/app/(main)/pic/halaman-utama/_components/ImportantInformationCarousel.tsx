"use client";

import type { ImportantInformationItem } from "@/types/important-information";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { PiCaretLeftBold, PiCaretRightBold } from "react-icons/pi";

type ImportantInformationCarouselProps = {
  items: ImportantInformationItem[];
};

export default function ImportantInformationCarousel({
  items,
}: ImportantInformationCarouselProps) {
  // Manual-only: Tanpa plugin Autoplay / timer
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const emblaOptions = useMemo(
    () => ({ loop: false, duration: prefersReducedMotion ? 0 : 25 }),
    [prefersReducedMotion],
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () =>
      setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollFirst = useCallback(() => emblaApi?.scrollTo(0), [emblaApi]);
  const scrollLast = useCallback(
    () => emblaApi?.scrollTo(items.length - 1),
    [emblaApi, items.length],
  );

  const handleKeyDown = (e: KeyboardEvent) => {
    if (items.length <= 1) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollNext();
    } else if (e.key === "Home") {
      e.preventDefault();
      scrollFirst();
    } else if (e.key === "End") {
      e.preventDefault();
      scrollLast();
    }
  };

  if (!items || items.length === 0) return null;

  const isMultiple = items.length > 1;

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Informasi Penting"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
    >
      {/* Viewport */}
      <div ref={emblaRef} className="overflow-hidden w-full">
        <div className="flex w-full">
          {items.map((item, index) => (
            <div
              key={item.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Informasi ${index + 1} dari ${items.length}`}
              className="relative aspect-2/1 w-full min-w-0 flex-[0_0_100%] overflow-hidden bg-slate-100"
            >
              <Image
                src={item.imageUrl}
                alt={item.altText}
                fill
                sizes="(min-width: 1280px) 1200px, 100vw"
                priority={index === 0}
                className="object-cover object-center"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Screen reader live announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Informasi {selectedIndex + 1} dari {items.length}
      </div>

      {/* Controls: Hanya tampil jika lebih dari 1 item */}
      {isMultiple && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 bg-white px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!emblaApi?.canScrollPrev()}
            aria-label={`Kembali ke informasi ${Math.max(1, selectedIndex)} dari ${items.length}`}
            className="flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
          >
            <PiCaretLeftBold className="h-5 w-5" />
          </button>

          <div
            role="group"
            aria-label="Indikator slide"
            className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2"
          >
            {items.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => scrollTo(index)}
                aria-label={`Tampilkan informasi ${index + 1} dari ${items.length}`}
                aria-current={selectedIndex === index ? "step" : undefined}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
              >
                <span
                  className={`block rounded-full transition-all duration-200 motion-reduce:transition-none ${
                    selectedIndex === index
                      ? "h-2 w-5 bg-blue-700"
                      : "h-2 w-2 bg-slate-300 hover:bg-slate-500"
                  }`}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={scrollNext}
            disabled={!emblaApi?.canScrollNext()}
            aria-label={`Tampilkan informasi ${Math.min(items.length, selectedIndex + 2)} dari ${items.length}`}
            className="flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
          >
            <PiCaretRightBold className="h-5 w-5" />
          </button>
        </div>
      )}
    </section>
  );
}
