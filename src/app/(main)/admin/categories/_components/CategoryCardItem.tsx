import type { CategoryWithStats } from "@/hooks/useCategoryList";
import { getCategoryCapabilityPreset } from "@/lib/category-capability-presets";
import { Button, Card, Chip, Tooltip } from "@heroui/react";
import Image from "next/image";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

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
  const cardColor = category.color || "#3b82f6";
  const capability = getCategoryCapabilityPreset({
    targetUnit: category.targetUnit,
    evidenceMode: category.evidenceMode,
    scoreInputMode: category.scoreInputMode,
  });
  const isCapabilityLocked = category.locks.capability;
  const isDeleteLocked = category.locks.deletion;
  const initials = category.name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const metrics: Array<[string, number]> = [
    ["Program", category.usage.programCount],
    ["Program aktif", category.usage.activeProgramCount],
    ["Laporan", category.usage.reportCount],
    ["Partisipasi", category.usage.participationCount],
    ["Riwayat skor", category.usage.historyCount],
  ];

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-none">
      <Card.Content className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          {category.bannerUrl ? (
            <Image
              src={category.bannerUrl}
              alt={category.name}
              className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover"
              width={56}
              height={56}
              unoptimized
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-lg font-bold text-white"
              style={{ backgroundColor: cardColor }}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-col items-start gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cardColor }}
                />
                <h3 className="line-clamp-2 text-base font-bold leading-5 tracking-tight text-slate-900">
                  {category.name}
                </h3>
              </div>
              <Chip
                size="sm"
                variant="soft"
                color="warning"
                className="max-w-full"
              >
                <Chip.Label className="text-xs font-semibold">
                  {category.targetUnit === "PARTISIPASI_PERSEN"
                    ? "Partisipasi (%)"
                    : "Kegiatan"}
                </Chip.Label>
              </Chip>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="space-y-3" aria-label="Kapabilitas kategori">
          <div className="flex flex-wrap gap-2">
            <Chip size="sm" variant="soft">
              <Chip.Label>Bukti: {capability.evidenceLabel}</Chip.Label>
            </Chip>
            <Chip size="sm" variant="soft">
              <Chip.Label>Nilai: {capability.scoreLabel}</Chip.Label>
            </Chip>
          </div>
          <p
            className={`text-xs font-medium ${isCapabilityLocked ? "text-amber-700" : "text-emerald-700"}`}
          >
            {isCapabilityLocked
              ? "Kapabilitas terkunci karena kategori sudah digunakan."
              : "Kapabilitas dapat diubah karena kategori belum digunakan."}
          </p>
        </div>
        {capability.showFrequency && (
          <div
            aria-label="Frekuensi kategori"
            className="border-t border-slate-200 pt-3 text-sm text-slate-600"
          >
            Frekuensi default:{" "}
            <span className="font-semibold text-slate-900">
              {category.defaultFrequency} / TW
            </span>
          </div>
        )}
        {isDeleteLocked && (
          <p
            className="text-xs font-medium text-red-700"
            aria-label="Alasan penghapusan terkunci"
          >
            Penghapusan terkunci karena kategori memiliki data terkait.
          </p>
        )}
      </Card.Content>
      <Card.Footer className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:justify-end">
        <Button
          size="md"
          variant="secondary"
          onPress={() => onEdit(category)}
          className="min-h-11 w-full font-semibold sm:w-auto"
        >
          <FiEdit2 className="mr-1 size-4" /> Edit
        </Button>
        {isDeleteLocked ? (
          <Tooltip delay={0}>
            <Tooltip.Trigger
              aria-label="Status hapus kategori"
              className="w-full sm:w-auto"
            >
              <Button
                size="md"
                variant="outline"
                isDisabled
                className="min-h-11 w-full cursor-not-allowed border-slate-200 text-slate-400 opacity-60 sm:w-auto"
              >
                <FiTrash2 className="mr-1 size-4" /> Hapus
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow placement="top">
              <Tooltip.Arrow />
              <p>
                Penghapusan tidak tersedia karena kategori memiliki program,
                laporan, data partisipasi, atau riwayat skor terkait.
              </p>
            </Tooltip.Content>
          </Tooltip>
        ) : (
          <Button
            size="md"
            variant="danger"
            onPress={() => onDelete(category.id)}
            isDisabled={isDeleting}
            isPending={isDeleting}
            className="min-h-11 w-full font-semibold sm:w-auto"
          >
            <FiTrash2 className="mr-1 size-4" />
            {isDeleting ? "Menghapus..." : "Hapus"}
          </Button>
        )}
      </Card.Footer>
    </Card>
  );
}
