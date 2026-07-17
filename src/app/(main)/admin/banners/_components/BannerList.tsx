import { Banner } from "@/hooks/useBanners";
import { Button, Card, Chip } from "@heroui/react";
import Image from "next/image";
import { BsCircleFill } from "react-icons/bs";
import { PiArrowDown, PiArrowUp, PiCamera, PiPencil, PiTrash } from "react-icons/pi";

interface BannerListProps {
  banners: Banner[];
  onEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
  onToggleStatus: (banner: Banner) => void;
  onReorder: (bannerId: string, direction: "up" | "down") => void;
  isUpdating?: boolean;
}

const PERIOD_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
];

export default function BannerList({
  banners,
  onEdit,
  onDelete,
  onToggleStatus,
  onReorder,
  isUpdating,
}: BannerListProps) {
  if (!banners || banners.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <PiCamera className="w-12 h-12 mb-3 text-slate-300" />
        <p className="font-medium">Belum ada banner</p>
        <p className="text-sm">
          Klik "Tambah Banner" untuk menambahkan banner pertama
        </p>
      </div>
    );
  }

  return (
    <Card className="divice-y divide-slate-100 shadow-sm border border-slate-200">
      <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-100">
        <p className="text-xs text-blue-700 font-medium flex items-center gap-2">
          <BsCircleFill className="w-1.5 h-1.5" />
          Banner ditampilkan berurutan di halaman login. Gunakan tombol panah
          untuk mengatur urutan tampil.
        </p>
      </div>

      {banners.map((banner, index) => {
        const colorTheme = PERIOD_COLORS[index % PERIOD_COLORS.length];

        return (
          <div
            key={banner.id}
            className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors ${!banner.isActive ? "opacity-50" : ""}`}
          >
            {/* Nomor urut */}
            <span className="text-sm font-bold text-slate-400 w-6 text-center shrink-0">
              {index + 1}
            </span>

            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 shrink-0">
              <Image
                src={banner.imageUrl}
                alt={banner.name}
                fill
                className="object-cover"
              />
            </div>

            {/* INFO PIC */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-slate-800 truncate">
                  {banner.name}
                </p>
                <Chip
                  size="sm"
                  variant="soft"
                  className={`${colorTheme.bg} ${colorTheme.text} border ${colorTheme.border} text-[10px] font-bold`}
                >
                  <Chip.Label>{banner.period}</Chip.Label>
                </Chip>
                {!banner.isActive && (
                  <Chip size="sm" variant="soft" color="danger">
                    <Chip.Label>Nonaktif</Chip.Label>
                  </Chip>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {banner.role} · {banner.unit}
              </p>
            </div>

            {/* Tombol reorder */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                isDisabled={index === 0 || isUpdating}
                onPress={() => onReorder(banner.id, "up")}
                className={
                  "text-slate-400 hover:text-slate-700 h-6 w-6 min-w-0"
                }
              >
                <PiArrowUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                isDisabled={index === banners.length - 1 || isUpdating}
                onPress={() => onReorder(banner.id, "down")}
                className={
                  "text-slate-400 hover:text-slate-700 h-6 w-6 min-w-0"
                }
              >
                <PiArrowDown className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Tombol edit */}
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => onEdit(banner)}
              className={"text-slate-400 hover:text-blue-600 "}
            >
              <PiPencil className="w-4 h-4" />
            </Button>

            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => onDelete(banner)}
              className={"text-slate-400 hover:text-red-600 "}
            >
              <PiTrash className="w-4 h-4" />
            </Button>
          </div>
        );
      })}
    </Card>
  );
}
