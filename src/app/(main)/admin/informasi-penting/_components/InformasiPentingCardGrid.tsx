"use client";
import type { ImportantInformationItem } from "@/types/important-information";
import InformasiPentingCardItem from "./InformasiPentingCardItem";

type InformasiPentingCardGridProps = {
  items: ImportantInformationItem[];
  onEdit: (item: ImportantInformationItem) => void;
  onDelete: (item: ImportantInformationItem) => void;
  onToggleStatus: (item: ImportantInformationItem) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  pendingStatusId?: string;
  pendingDeleteId?: string;
  isReorderPending?: boolean;
};

export default function InformasiPentingCardGrid({
  items,
  ...props
}: InformasiPentingCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <InformasiPentingCardItem
          key={item.id}
          item={item}
          index={index}
          totalItems={items.length}
          {...props}
        />
      ))}
    </div>
  );
}
