"use client";

import { Banner } from "@/hooks/useBanners";
import { Card } from "@heroui/react";
import { PiCamera } from "react-icons/pi";
import BannerCardItem from "./BannerCardItem";

interface BannerCardGridProps {
  banners: Banner[];
  onEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
  onToggleStatus: (banner: Banner) => void;
  onReorder: (bannerId: string, direction: "up" | "down") => void;
  isUpdating?: boolean;
}

export default function BannerCardGrid({
  banners,
  onEdit,
  onDelete,
  onToggleStatus,
  onReorder,
  isUpdating,
}: BannerCardGridProps) {
  if (!banners || banners.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 text-slate-400 border border-slate-200/80 shadow-sm bg-white">
        <PiCamera className="w-12 h-12 mb-3 text-slate-300" />
        <p className="font-semibold text-slate-700">Belum Ada Banner</p>
        <p className="text-xs text-slate-500 mt-1">
          Klik "Tambah Banner" untuk mengunggah banner PIC terbaik pertama Anda.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {banners.map((banner, index) => (
        <BannerCardItem
          key={banner.id}
          banner={banner}
          index={index}
          totalBanners={banners.length}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleStatus={onToggleStatus}
          onReorder={onReorder}
          isUpdating={isUpdating}
        />
      ))}
    </div>
  );
}
