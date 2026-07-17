import { Chip, Label } from "@heroui/react";
import Image from "next/image";
import { PiImage, PiTrophyFill, PiStarFill } from "react-icons/pi";

interface BannerPreviewCardProps {
  imageUrl: string | null;
  name: string;
  role: string;
  unit: string;
  period: string;
}

export default function BannerPreviewCard({
  imageUrl,
  name,
  role,
  unit,
  period,
}: BannerPreviewCardProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-slate-700">
        Preview Carousel
      </Label>

      <div
        className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
        style={{ height: 380 }}
      >
        <div className="absolute inset-0 bg-slate-900">
          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt="Preview Banner"
                fill
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/30 to-transparent" />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <PiImage className="w-12 h-12 text-slate-600 mb-2" />
              <p className="text-sm text-slate-500 font-medium">Preview Foto</p>
            </div>
          )}
        </div>

        <div className="absolute top-4 left-4 z-10">
          <Chip color="warning" variant="primary" size="sm">
            <PiTrophyFill className="text-white text-xs" />
            <Chip.Label className="text-white text-[10px] font-bold">
              PIC TERBAIK
            </Chip.Label>
          </Chip>
        </div>

        {/* Badge Periode — kanan atas */}
        {period && (
          <div className="absolute top-4 right-4 z-10">
            <Chip className="bg-slate-900/60 backdrop-blur-md border border-white/15 px-3 py-1 flex items-center gap-1.5 rounded-full font-bold text-xs text-white">
              <PiStarFill className="text-amber-400 text-xs shrink-0" />
              <Chip.Label className="text-white text-[10px] font-bold">
                {period.toUpperCase()}
              </Chip.Label>
            </Chip>
          </div>
        )}

        {/* info overlay bottom */}
        <div className="absolute bottom-4 left-4 z-10 text-white space-y-1">
          <h3 className="text-lg font-extrabold tracking-tight leading-tight drop-shadow-md">
            {name || "Nama PIC"}
          </h3>

          {/* Jabatan */}
          <p className="text-xs text-blue-100/50 font-medium">
            {role || "Jabatan"}
          </p>

          {/* UNIT KERJA */}
          <p className="text-[11px] text-cyan-400 font-bold">
            {unit || "Unit / Wilayah"}
          </p>
        </div>
      </div>
    </div>
  );
}
