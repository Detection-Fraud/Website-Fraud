import { Button, Card, Chip } from "@heroui/react";
import { BiCheckCircle, BiPowerOff } from "react-icons/bi";
import { FiCalendar, FiEdit2, FiGrid, FiTarget } from "react-icons/fi";
import { ProgramBudayaWithCategory } from "@/hooks/useProgramQuery";
import { ProgramBudaya } from "@generated/prisma";
import { ProgramCardBanner } from "./ProgramCardBanner";

interface ProgramCardItemProps {
  program: ProgramBudayaWithCategory;
  onEdit?: (program: ProgramBudaya) => void;
  onToggleStatus?: (program: ProgramBudaya) => void;
}

const TW_LABELS: Record<number, string> = {
  1: "TW I",
  2: "TW II",
  3: "TW III",
  4: "TW IV",
};

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function ProgramCardItem({
  program,
  onEdit,
  onToggleStatus,
}: ProgramCardItemProps) {
  const isActive = program.isActive;
  const categoryColor = program.category?.color || "#3b82f6";
  const displayBanner = program.bannerUrl || program.category?.bannerUrl;
  const satuan =
    program.category?.targetUnit === "PARTISIPASI_PERSEN"
      ? "Partisipasi (%)"
      : "Kegiatan";

  return (
    <Card
      variant="default"
      style={{ borderTopColor: categoryColor }}
      className="flex flex-col border border-zinc-200 dark:border-zinc-800 border-t-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden group"
    >
      <ProgramCardBanner
        bannerUrl={displayBanner}
        programName={program.name}
        categoryName={program.category?.name}
        categoryColor={categoryColor}
      />

      <Card.Header className="flex flex-col items-start px-5 pt-4 pb-0 gap-1.5">
        <div className="flex w-full justify-between items-start gap-2">
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

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
              isActive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-zinc-400"}`}
            />
            {isActive ? "Aktif" : "Nonaktif"}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mt-0.5">
          {program.name}
        </h3>
      </Card.Header>

      <Card.Content className="px-5 py-3 flex flex-col gap-3 flex-1">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed min-h-10">
          {program.description || "Tidak ada deskripsi untuk program ini."}
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
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

          <div className="col-span-2 flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
              <FiCalendar className="w-3 h-3 shrink-0" />
              <span className="text-[10px] uppercase tracking-wide">
                Periode
              </span>
            </div>
            <span className="text-xs text-zinc-600 dark:text-zinc-300">
              {formatDate(program.startDate)} – {formatDate(program.endDate)}
            </span>
          </div>
        </div>
      </Card.Content>

      <div className="px-4 py-2.5 flex justify-between items-center mt-auto border-t border-zinc-100 dark:border-zinc-800/80">
        <span className="text-[10px] text-zinc-400">
          {program.tw == null ? (
            <i className="italic">Berlaku sepanjang tahun</i>
          ) : (
            TW_LABELS[program.tw]
          )}
        </span>

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
}
