import { CategoryWithStats } from "@/hooks/useCategoryList";
import { Button, Card, Chip, Tooltip } from "@heroui/react";
import Image from "next/image";
import { FiEdit2, FiLayers, FiTarget, FiTrash2 } from "react-icons/fi";

interface CategoryCardItemProps {
  category: CategoryWithStats;
  onEdit: (category: CategoryWithStats) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

export default function CategoryCardItem({
  category,
  onEdit,
  onDelete,
  isDeleting,
}: CategoryCardItemProps) {
  const hasPrograms = category.totalProgram > 0;
  const cardColor = category.color || "#3b82f6";
  return (
    <Card className="border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden flex flex-col justify-between group bg-white">
      {/* 1. TOP BANNER COVER HEADER */}
      <div className="relative h-32 w-full overflow-hidden bg-slate-100">
        {category.bannerUrl ? (
          <Image
            src={category.bannerUrl}
            alt={category.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            width={800}
            height={600}
            unoptimized
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${cardColor}dd, ${cardColor}66)`,
            }}
          />
        )}

        {/* Floating Target Unit Chip (Top Right) */}
        <div className="absolute top-3 right-3">
          <Chip
            size="sm"
            className="bg-white/90 backdrop-blur-md text-slate-800 border border-white/50 shadow-xs font-semibold"
          >
            <Chip.Label className="text-[10px] uppercase tracking-wider">
              {category.targetUnit === "PARTISIPASI_PERSEN"
                ? "Partisipasi %"
                : "Kegiatan"}
            </Chip.Label>
          </Chip>
        </div>
      </div>

      {/* 2. CARD CONTENT BODY */}
      <Card.Content className="p-5 space-y-4">
        {/* Title + Luminous Color Dot */}
        <div className="flex items-center gap-2">
          <span
            className="size-3 rounded-full shrink-0 shadow-xs ring-2 ring-white"
            style={{ backgroundColor: cardColor }}
          />
          <h3 className="text-base font-bold text-slate-900 tracking-tight truncate">
            {category.name}
          </h3>
        </div>

        {/* Stats Grid - Vertical Stack */}
        <div className="grid grid-cols-2 gap-2">
          {/* Total Program */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider min-w-0">
              <FiLayers className="size-3 shrink-0 text-slate-400" />
              <span className="truncate">Total Program</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-extrabold text-slate-900">
                {category.totalProgram}
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 whitespace-nowrap">
                ({category.totalActive} aktif)
              </span>
            </div>
          </div>

          {/* Freq Default */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider min-w-0">
              <FiTarget className="size-3 shrink-0 text-slate-400" />
              <span className="truncate">Freq Default</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-extrabold text-slate-900">
                {category.defaultFrequency}x
              </span>
              <span className="text-[10px] font-medium text-slate-500">
                / TW
              </span>
            </div>
          </div>
        </div>
      </Card.Content>

      {/* 3. ACTION FOOTER */}
      <div className="px-5 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onPress={() => onEdit(category)}
          className="h-8 text-xs font-semibold"
        >
          <FiEdit2 className="size-3.5 mr-1" /> Edit
        </Button>

        {hasPrograms ? (
          <Tooltip delay={0}>
            <Tooltip.Trigger aria-label="Status hapus kategori">
              <Button
                size="sm"
                variant="outline"
                isDisabled
                className="h-8 text-xs text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
              >
                <FiTrash2 className="size-3.5 mr-1" /> Hapus
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow placement="top">
              <Tooltip.Arrow />
              <p>
                Kategori tidak dapat dihapus karena masih memiliki program
                terkait
              </p>
            </Tooltip.Content>
          </Tooltip>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onPress={() => onDelete(category.id)}
            isDisabled={isDeleting}
            className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
          >
            <FiTrash2 className="size-3.5 mr-1" />{" "}
            {isDeleting ? "..." : "Hapus"}
          </Button>
        )}
      </div>
    </Card>
  );
}
