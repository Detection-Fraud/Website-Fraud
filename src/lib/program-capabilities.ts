export type CategoryCapabilities = {
  targetUnit: "KEGIATAN" | "PARTISIPASI_PERSEN";
  evidenceMode: "NONE" | "PHOTO_WITH_AI" | "PHOTO_WITHOUT_AI";
  scoreInputMode: "NONE" | "EXCEL_IMPORT" | "DIRECT_ADMIN";
};

const VALID_CAPABILITIES: readonly CategoryCapabilities[] = [
  {
    targetUnit: "KEGIATAN",
    evidenceMode: "PHOTO_WITH_AI",
    scoreInputMode: "NONE",
  },
  {
    targetUnit: "PARTISIPASI_PERSEN",
    evidenceMode: "PHOTO_WITHOUT_AI",
    scoreInputMode: "DIRECT_ADMIN",
  },
  {
    targetUnit: "PARTISIPASI_PERSEN",
    evidenceMode: "NONE",
    scoreInputMode: "EXCEL_IMPORT",
  },
];

function isValidCapability(input: CategoryCapabilities): boolean {
  return VALID_CAPABILITIES.some(
    (capability) =>
      capability.targetUnit === input.targetUnit &&
      capability.evidenceMode === input.evidenceMode &&
      capability.scoreInputMode === input.scoreInputMode,
  );
}

export function requiresEvidence(input: CategoryCapabilities): boolean {
  return input.evidenceMode !== "NONE";
}

export function requiresAiCheck(input: CategoryCapabilities): boolean {
  return input.evidenceMode === "PHOTO_WITH_AI";
}

export function usesDirectAdminScore(input: CategoryCapabilities): boolean {
  return (
    input.targetUnit === "PARTISIPASI_PERSEN" &&
    input.evidenceMode === "PHOTO_WITHOUT_AI" &&
    input.scoreInputMode === "DIRECT_ADMIN"
  );
}

export function canImportParticipation(input: CategoryCapabilities): boolean {
  return (
    input.targetUnit === "PARTISIPASI_PERSEN" &&
    input.evidenceMode === "NONE" &&
    input.scoreInputMode === "EXCEL_IMPORT"
  );
}

export function getCapabilityError(input: CategoryCapabilities): string | null {
  if (isValidCapability(input)) return null;

  if (input.targetUnit === "KEGIATAN") {
    return "Kategori KEGIATAN wajib menggunakan foto dengan AI dan tanpa input nilai";
  }

  if (input.targetUnit !== "PARTISIPASI_PERSEN") {
    return "Satuan target tidak didukung";
  }

  return "Kategori partisipasi harus menggunakan Excel tanpa bukti foto atau penilaian admin dengan bukti foto";
}
