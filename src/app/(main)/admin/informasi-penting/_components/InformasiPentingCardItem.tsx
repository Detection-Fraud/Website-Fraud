"use client";

import type { ImportantInformationItem } from "@/types/important-information";
import { Button, Card, Switch, Tooltip } from "@heroui/react";
import Image from "next/image";
import { PiArrowDown, PiArrowUp, PiPencil, PiTrash } from "react-icons/pi";

type InformasiPentingCardItemProps = {
  item: ImportantInformationItem;
  index: number;
  totalItems: number;
  onEdit: (item: ImportantInformationItem) => void;
  onDelete: (item: ImportantInformationItem) => void;
  onToggleStatus: (item: ImportantInformationItem) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  pendingStatusId?: string;
  pendingDeleteId?: string;
  isReorderPending?: boolean;
};

export default function InformasiPentingCardItem({
  item,
  index,
  totalItems,
  onEdit,
  onDelete,
  onToggleStatus,
  onReorder,
  pendingStatusId,
  pendingDeleteId,
  isReorderPending,
}: InformasiPentingCardItemProps) {
  const position = index + 1;
  const isStatusPending = pendingStatusId === item.id;
  const isDeletePending = pendingDeleteId === item.id;

  return (
    <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-sm flex flex-col justify-between">
      {/* Media Image with 2:1 ratio */}
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-slate-100">
        <Image
          src={item.imageUrl}
          alt={item.altText}
          fill
          className="object-cover object-center"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
        <span className="absolute left-3 top-3 rounded-md bg-white/90 backdrop-blur-sm px-2 py-1 text-xs font-bold text-slate-800 shadow-sm">
          Posisi {position}
        </span>
      </div>

      {/* Details & Actions */}
      <div className="flex flex-col gap-3 p-3 sm:p-4 border-t border-slate-100">
        <p className="text-xs text-slate-600 line-clamp-2 min-h-8 font-medium">
          {item.altText}
        </p>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50">
          {/* Status Switch */}
          <div className="flex items-center gap-2">
            <Switch
              isSelected={item.isActive}
              isDisabled={isStatusPending || isReorderPending}
              onChange={() => onToggleStatus(item)}
              aria-label={`${
                item.isActive ? "Nonaktifkan" : "Aktifkan"
              } informasi posisi ${position}`}
              className="min-h-11 min-w-11"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
            <span
              className={`text-xs font-semibold ${
                item.isActive ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {item.isActive ? "Aktif" : "Nonaktif"}
            </span>
          </div>

          {/* Action Buttons with 44x44px target touch */}
          <div className="flex items-center gap-1">
            <Tooltip delay={0}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                isDisabled={index === 0 || isReorderPending}
                onPress={() => onReorder(item.id, "up")}
                data-reorder-id={item.id}
                data-reorder-direction="up"
                aria-label={`Naikkan informasi posisi ${position} ke posisi ${
                  position - 1
                }`}
                className="text-slate-400 hover:text-slate-700 min-h-11 min-w-11 h-11 w-11"
              >
                <PiArrowUp className="w-4 h-4" />
              </Button>
              <Tooltip.Content showArrow placement="top">
                <Tooltip.Arrow />
                <p>Naikkan posisi</p>
              </Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                isDisabled={index === totalItems - 1 || isReorderPending}
                onPress={() => onReorder(item.id, "down")}
                data-reorder-id={item.id}
                data-reorder-direction="down"
                aria-label={`Turunkan informasi posisi ${position} ke posisi ${
                  position + 1
                }`}
                className="text-slate-400 hover:text-slate-700 min-h-11 min-w-11 h-11 w-11"
              >
                <PiArrowDown className="w-4 h-4" />
              </Button>
              <Tooltip.Content showArrow placement="top">
                <Tooltip.Arrow />
                <p>Turunkan posisi</p>
              </Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => onEdit(item)}
                aria-label={`Edit informasi posisi ${position}`}
                className="text-slate-400 hover:text-blue-600 min-h-11 min-w-11 h-11 w-11"
              >
                <PiPencil className="w-4 h-4" />
              </Button>
              <Tooltip.Content showArrow placement="top">
                <Tooltip.Arrow />
                <p>Edit</p>
              </Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <Button
                isIconOnly
                size="sm"
                variant="danger-soft"
                onPress={() => onDelete(item)}
                isDisabled={isDeletePending}
                isPending={isDeletePending}
                aria-label={`Hapus informasi posisi ${position}`}
                className="text-slate-400 hover:text-red-600 min-h-11 min-w-11 h-11 w-11"
              >
                <PiTrash className="w-4 h-4" />
              </Button>
              <Tooltip.Content showArrow placement="top">
                <Tooltip.Arrow />
                <p>Hapus</p>
              </Tooltip.Content>
            </Tooltip>
          </div>
        </div>
      </div>
    </Card>
  );
}
