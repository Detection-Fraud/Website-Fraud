import Image from "next/image";
import { FiFolder } from "react-icons/fi";

interface ProgramCardBannerProps {
  bannerUrl?: string | null;
  programName: string;
  categoryName?: string;
  categoryColor: string;
}

export function ProgramCardBanner({
  bannerUrl,
  programName,
  categoryName = "Program Budaya",
  categoryColor,
}: ProgramCardBannerProps) {
  return (
    <div className="relative h-24 w-full overflow-hidden bg-slate-900">
      {bannerUrl ? (
        <Image
          src={bannerUrl}
          alt={programName}
          fill
          unoptimized
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div
          className="w-full h-full relative flex items-center justify-between px-5 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${categoryColor}ee, ${categoryColor}88, #0f172a)`,
          }}
        >
          {/* Dot Grid Pattern Overlay */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)`,
              backgroundSize: "14px 14px",
            }}
          />

          {/* Initial Watermark Letter */}
          <div className="absolute -right-3 -bottom-5 text-7xl font-black text-white/10 select-none tracking-tighter uppercase font-mono">
            {categoryName.slice(0, 2) || programName.slice(0, 2)}
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white shadow-sm animate-pulse" />
            <span className="text-xs font-bold text-white/90 uppercase tracking-widest drop-shadow-sm">
              {categoryName}
            </span>
          </div>

          <FiFolder className="relative z-10 size-7 text-white/25" />
        </div>
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}
