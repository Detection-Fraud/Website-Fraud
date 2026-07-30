import { ProgramBudayaWithCategory } from "@/hooks/useProgramQuery";
import { ProgramBudaya } from "@generated/prisma";
import { Button, Card, Chip } from "@heroui/react";
import Image from "next/image";
import { BiCheckCircle, BiPowerOff } from "react-icons/bi";
import { FiCalendar, FiEdit2, FiFolder, FiGrid, FiTarget } from "react-icons/fi";

interface CardProgramsProps {
  programs: ProgramBudayaWithCategory[];
  onEdit?: (program: ProgramBudaya) => void;
  onToggleStatus?: (program: ProgramBudaya) => void;
}

const TW_LABELS: Record<number, string> = {
  1: "TW I",
  2: "TW II",
  3: "TW III",
  4: "TW IV",
};

const colorThemes = [
  {
    border: "border-t-sky-400",
    chipBg: "bg-sky-100/60 dark:bg-sky-900/20",
    chipText: "text-sky-700 dark:text-sky-400",
    chipBorder: "border-sky-200/50 dark:border-sky-700/30",
    bar: "bg-sky-400",
    twBg: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  {
    border: "border-t-emerald-400",
    chipBg: "bg-emerald-100/60 dark:bg-emerald-900/20",
    chipText: "text-emerald-700 dark:text-emerald-400",
    chipBorder: "border-emerald-200/50 dark:border-emerald-700/30",
    bar: "bg-emerald-400",
    twBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  {
    border: "border-t-violet-400",
    chipBg: "bg-violet-100/60 dark:bg-violet-900/20",
    chipText: "text-violet-700 dark:text-violet-400",
    chipBorder: "border-violet-200/50 dark:border-violet-700/30",
    bar: "bg-violet-400",
    twBg: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  {
    border: "border-t-amber-400",
    chipBg: "bg-amber-100/60 dark:bg-amber-900/20",
    chipText: "text-amber-700 dark:text-amber-400",
    chipBorder: "border-amber-200/50 dark:border-amber-700/30",
    bar: "bg-amber-400",
    twBg: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    border: "border-t-rose-400",
    chipBg: "bg-rose-100/60 dark:bg-rose-900/20",
    chipText: "text-rose-700 dark:text-rose-400",
    chipBorder: "border-rose-200/50 dark:border-rose-700/30",
    bar: "bg-rose-400",
    twBg: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  },
  {
    border: "border-t-indigo-400",
    chipBg: "bg-indigo-100/60 dark:bg-indigo-900/20",
    chipText: "text-indigo-700 dark:text-indigo-400",
    chipBorder: "border-indigo-200/50 dark:border-indigo-700/30",
    bar: "bg-indigo-400",
    twBg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
];

const getCategoryTheme = (categoryName: string = "Uncategorized") => {
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorThemes[Math.abs(hash) % colorThemes.length];
};

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function CardPrograms({
  programs,
  onEdit,
  onToggleStatus,
}: CardProgramsProps) {
  if (!programs || programs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2 text-zinc-400">
        <FiGrid className="w-8 h-8 opacity-30" />
        <p className="text-sm">Tidak ada data program budaya</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {programs.map((program) => {
        const isActive = program.isActive;
        const categoryColor = program.category?.color || "#3b82f6";
        const satuan =
          program.category?.targetUnit === "PARTISIPASI_PERSEN"
            ? "Partisipasi (%)"
            : "Kegiatan";

        const displayBanner = program.bannerUrl || program.category?.bannerUrl;
        return (
          <Card
            key={program.id}
            variant="default"
            style={{ borderTopColor: categoryColor }}
            className={`
              flex flex-col
              border border-zinc-200 dark:border-zinc-800
              border-t-4
              shadow-sm hover:shadow-md hover:-translate-y-0.5
              transition-all duration-200
              bg-white dark:bg-zinc-900
              rounded-xl overflow-hidden
              group
            `}
          >
            {/* Top Banner Cover Header (3-tier Fallback Strategy) */}
            <div className="relative h-24 w-full overflow-hidden bg-slate-900">
              {displayBanner ? (
                <Image
                  src={displayBanner}
                  alt={program.name}
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
                  {/* Subtle SVG Dot Grid Pattern Overlay */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.8) 1px, transparent 0)`,
                      backgroundSize: "14px 14px",
                    }}
                  />

                  {/* Giant Watermark Initial Letter */}
                  <div className="absolute -right-3 -bottom-5 text-7xl font-black text-white/10 select-none tracking-tighter uppercase font-mono">
                    {program.category?.name?.slice(0, 2) || program.name.slice(0, 2)}
                  </div>

                  {/* Minimal Category Accent */}
                  <div className="relative z-10 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white shadow-sm animate-pulse" />
                    <span className="text-xs font-bold text-white/90 uppercase tracking-widest drop-shadow-sm">
                      {program.category?.name || "Program Budaya"}
                    </span>
                  </div>

                  {/* Decorative Folder Icon Watermark */}
                  <FiFolder className="relative z-10 size-7 text-white/25" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            </div>
            {/* ── Header ── */}
            <Card.Header className="flex flex-col items-start px-5 pt-4 pb-0 gap-1.5">
              <div className="flex w-full justify-between items-start gap-2">
                {/* Kiri: chip kategori + badge TW */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Chip
                    size="sm"
                    variant="soft"
                    style={{
                      backgroundColor: `${categoryColor}18`,
                      color: categoryColor,
                      borderColor: `${categoryColor}40`,
                    }}
                    className="border font-semibold text-[10px] uppercase tracking-wider px-2"
                  >
                    {program.category?.name || "Uncategorized"}
                  </Chip>

                  {/* Badge TW — hanya tampil jika tw diset */}
                  {program.tw != null && (
                    <span
                      style={{
                        backgroundColor: `${categoryColor}12`,
                        color: categoryColor,
                      }}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide"
                    >
                      <FiGrid className="w-2.5 h-2.5" />
                      {TW_LABELS[program.tw] ?? `TW ${program.tw}`}
                    </span>
                  )}
                </div>

                {/* Kanan: status pill */}
                <span
                  className={`
                    inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                    text-[10px] font-medium shrink-0
                    ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }
                  `}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? "bg-emerald-500" : "bg-zinc-400"
                    }`}
                  />
                  {isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mt-0.5">
                {program.name}
              </h3>
            </Card.Header>

            {/* ── Body ── */}
            <Card.Content className="px-5 py-3 flex flex-col gap-3 flex-1">
              {/* Deskripsi */}
              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed min-h-[2.5rem]">
                {program.description ||
                  "Tidak ada deskripsi untuk program ini."}
              </p>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {/* Target frekuensi */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                    <FiTarget className="w-3 h-3 shrink-0" />
                    <span className="text-[10px] uppercase tracking-wide">
                      Target
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                    {program.frequency}x{" "}
                    <span className="font-normal text-zinc-400">/ TW</span>
                  </span>
                </div>

                {/* Satuan */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                    <span className="text-[10px] uppercase tracking-wide">
                      Satuan
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                    {satuan}
                  </span>
                </div>

                {/* Periode */}
                <div className="col-span-2 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                    <FiCalendar className="w-3 h-3 shrink-0" />
                    <span className="text-[10px] uppercase tracking-wide">
                      Periode
                    </span>
                  </div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-300">
                    {formatDate(program.startDate)} –{" "}
                    {formatDate(program.endDate)}
                  </span>
                </div>
              </div>
            </Card.Content>

            {/* ── Footer ── */}
            <div className="px-4 py-2.5 flex justify-between items-center mt-auto border-t border-zinc-100 dark:border-zinc-800/80">
              {/* Info TW di footer jika tw null */}
              {program.tw == null ? (
                <span className="text-[10px] text-zinc-400 italic">
                  Berlaku sepanjang tahun
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400">
                  {TW_LABELS[program.tw]}
                </span>
              )}

              <div className="flex items-center gap-1">
                <Button
                  variant="tertiary"
                  size="sm"
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium rounded-lg h-7 px-2.5 text-xs"
                  onPress={() => onEdit?.(program)}
                >
                  <FiEdit2 className="w-3 h-3" />
                  Edit
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  className={`font-medium rounded-lg h-7 px-2.5 text-xs ${
                    isActive
                      ? "text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/10"
                      : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                  }`}
                  onPress={() => onToggleStatus?.(program)}
                >
                  {isActive ? (
                    <BiPowerOff className="w-3.5 h-3.5" />
                  ) : (
                    <BiCheckCircle className="w-3.5 h-3.5" />
                  )}
                  {isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
