export interface CanonicalUnitCodeSource {
  kodeOrg: string | null | undefined;
}

export function normalizeUnitCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Kode Unit harus berupa teks");
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Kode Unit wajib diisi");
  }

  return normalized;
}

export function getUnitCodeCanonicalKey(value: unknown): string {
  return normalizeUnitCode(value).toLocaleLowerCase("en-US");
}

export function getCanonicalUnitCode(unit: CanonicalUnitCodeSource): string {
  return normalizeUnitCode(unit.kodeOrg);
}
