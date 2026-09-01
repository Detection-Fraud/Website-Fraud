import type { CategoryCapabilities } from "@/lib/program-capabilities";

export type CategoryCapabilityPreset = CategoryCapabilities & {
  id: string;
  title: string;
  description: string;
  evidenceLabel: string;
  scoreLabel: string;
  showFrequency: boolean;
  isSelectable: boolean;
};

export type CategoryCapabilityPresentation = {
  id: string;
  title: string;
  description: string;
  evidenceLabel: string;
  scoreLabel: string;
  showFrequency: boolean;
  isSelectable: boolean;
  targetUnit?: CategoryCapabilities["targetUnit"];
  evidenceMode?: CategoryCapabilities["evidenceMode"];
  scoreInputMode?: CategoryCapabilities["scoreInputMode"];
};

export const CATEGORY_CAPABILITY_PRESETS = [
  {
    id: "KEGIATAN_PHOTO_WITH_AI_NONE",
    title: "Kegiatan — Foto dengan AI",
    description: "KEGIATAN · PHOTO_WITH_AI · tanpa input nilai",
    evidenceLabel: "Foto + AI",
    scoreLabel: "Tidak ada",
    targetUnit: "KEGIATAN",
    evidenceMode: "PHOTO_WITH_AI",
    scoreInputMode: "NONE",
    showFrequency: true,
    isSelectable: true,
  },
  {
    id: "PARTISIPASI_PHOTO_WITHOUT_AI_DIRECT_ADMIN",
    title: "Partisipasi — Foto tanpa AI, dinilai Admin",
    description: "PARTISIPASI_PERSEN · PHOTO_WITHOUT_AI · DIRECT_ADMIN",
    evidenceLabel: "Foto tanpa AI",
    scoreLabel: "Admin",
    targetUnit: "PARTISIPASI_PERSEN",
    evidenceMode: "PHOTO_WITHOUT_AI",
    scoreInputMode: "DIRECT_ADMIN",
    showFrequency: true,
    isSelectable: true,
  },
  {
    id: "PARTISIPASI_NONE_EXCEL_IMPORT",
    title: "Partisipasi — Input melalui Excel",
    description: "PARTISIPASI_PERSEN · tanpa foto · EXCEL_IMPORT",
    evidenceLabel: "Tidak ada",
    scoreLabel: "Excel",
    targetUnit: "PARTISIPASI_PERSEN",
    evidenceMode: "NONE",
    scoreInputMode: "EXCEL_IMPORT",
    showFrequency: false,
    isSelectable: true,
  },
] as const satisfies readonly CategoryCapabilityPreset[];

const UNMATCHED_CAPABILITY_PRESENTATION: CategoryCapabilityPresentation = {
  id: "UNMATCHED",
  title: "Kapabilitas tidak dikenali",
  description:
    "Konfigurasi kapabilitas tidak cocok dengan preset yang tersedia",
  evidenceLabel: "Tidak tersedia",
  scoreLabel: "Tidak tersedia",
  showFrequency: false,
  isSelectable: false,
};

export function getCategoryCapabilityPreset(
  input: CategoryCapabilities,
): CategoryCapabilityPresentation {
  return (
    CATEGORY_CAPABILITY_PRESETS.find(
      (preset) =>
        preset.targetUnit === input.targetUnit &&
        preset.evidenceMode === input.evidenceMode &&
        preset.scoreInputMode === input.scoreInputMode,
    ) ?? UNMATCHED_CAPABILITY_PRESENTATION
  );
}

export function getCategoryCapabilityPresetForForm(
  id: string,
): CategoryCapabilityPreset {
  return (
    CATEGORY_CAPABILITY_PRESETS.find((preset) => preset.id === id) ??
    CATEGORY_CAPABILITY_PRESETS[0]
  );
}
