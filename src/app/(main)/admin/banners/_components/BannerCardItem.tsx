import { Banner } from "@/hooks/useBanners";
import { Button, Card, Chip, Switch } from "@heroui/react";
import Image from "next/image";
import { PiArrowDown, PiArrowUp, PiPencil, PiStarFill, PiTrash } from "react-icons/pi";

interface BannerCardItemProps {
  banner: Banner;
  index: number;
  totalBanners: number;
  onEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
  onToggleStatus: (banner: Banner) => void;
  onReorder: (bannerId: string, direction: "up" | "down") => void;
  isUpdating?: boolean;
}

export default function BannerCardItem({
  banner,
  index,
  totalBanners,
  onEdit,
  onDelete,
  onToggleStatus,
  onReorder,
  isUpdating,
}: BannerCardItemProps) {
  return (
    <Card
      className={`relative overflow-hidden border transition-all duration-300 ${banner.isActive ? "border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 bg-white" : "border-slate-200/60 bg-slate-50/70 opacity-75"}`}
    >
      <div className="relative w-full aspect-video bg-slate-900 overflow-hidden">
        {banner.imageUrl ? (
          <>
            <Image
              src={banner.imageUrl}
              alt={banner.name}
              fill
              className={`object-cover object-center transition-transform duration-500 hover:scale-105 ${
                !banner.isActive ? "grayscale opacity-60" : ""
              }`}
            />

            <div className="absolute inset-0 bg-linear-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs">
            Foti tidak tersedia
          </div>
        )}

        <div className="absolute top-3 left-3 z-10">
          <span className="px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-md text-white font-mono font-bold text-xs border border-white/10 shadow-sm">
            #{index + 1}
          </span>
        </div>

        {/* Status Active/Inactive Badge (Pojok Kanan Atas) */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {banner.period && (
            <Chip
              size="sm"
              className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold border border-white/10"
            >
              <PiStarFill className="text-amber-400 text-xs mr-1" />
              {banner.period.toUpperCase()}
            </Chip>
          )}
        </div>

        {/* Title & Info Overlay at Bottom of Image */}
        <div className="absolute bottom-3 left-3 right-3 z-10 text-white">
          <h4 className="font-bold text-base line-clamp-1 drop-shadow-sm">
            {banner.name}
          </h4>
          <p className="text-xs text-slate-300 line-clamp-1">{banner.role}</p>
          <p className="text-[11px] text-cyan-300 font-semibold line-clamp-1">
            {banner.unit}
          </p>
        </div>
      </div>

      {/* Card Footer Controls & Actions */}
      <div className="p-3 bg-white flex items-center justify-between gap-2 border-t border-slate-100">
        {/* Toggle Switch Active (HeroUI v3 Compound Component) */}
        <div className="flex items-center gap-2">
          <Switch
            isSelected={banner.isActive}
            onChange={() => onToggleStatus(banner)}
            isDisabled={isUpdating}
            aria-label="Toggle active status"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
          <span
            className={`text-xs font-semibold ${
              banner.isActive ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            {banner.isActive ? "Aktif" : "Non-aktif"}
          </span>
        </div>

        {/* Actions (Reorder Up/Down + Edit + Delete) */}
        <div className="flex items-center gap-1">
          {/* Reorder Up */}
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            isDisabled={index === 0 || isUpdating}
            onPress={() => onReorder(banner.id, "up")}
            className="text-slate-400 hover:text-slate-700 h-8 w-8 sm:h-7 sm:w-7 min-w-0"
            aria-label="Geser Ke Atas"
          >
            <PiArrowUp className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </Button>

          {/* Reorder Down */}
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            isDisabled={index === totalBanners - 1 || isUpdating}
            onPress={() => onReorder(banner.id, "down")}
            className="text-slate-400 hover:text-slate-700 h-8 w-8 sm:h-7 sm:w-7 min-w-0"
            aria-label="Geser Ke Bawah"
          >
            <PiArrowDown className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </Button>

          {/* Edit Button */}
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => onEdit(banner)}
            className="text-slate-400 hover:text-blue-600 h-8 w-8 sm:h-7 sm:w-7 min-w-0 ml-1"
            aria-label="Edit Banner"
          >
            <PiPencil className="w-4 h-4" />
          </Button>

          {/* Delete Button */}
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => onDelete(banner)}
            className="text-slate-400 hover:text-rose-600 h-8 w-8 sm:h-7 sm:w-7 min-w-0"
            aria-label="Hapus Banner"
          >
            <PiTrash className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
