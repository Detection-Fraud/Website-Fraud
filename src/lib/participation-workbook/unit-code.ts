export interface CanonicalUnitCodeSource {
  kodeOrg: string | null | undefined;
  kodeDolog: string | null | undefined;
  kodeSubdolog: string | null | undefined;
  type: "DIVISI" | "KANTOR_WILAYAH" | "KANTOR_CABANG";
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
  const kodeOrg = normalizeUnitCode(unit.kodeOrg);

  if (unit.type === "DIVISI") {
    return `DIVISI:${kodeOrg}`;
  }

  const kodeDolog = normalizeUnitCode(unit.kodeDolog);
  const kodeSubdolog = normalizeUnitCode(unit.kodeSubdolog);

  if (kodeDolog === "00") {
    throw new Error("Kode DOLOG Unit wilayah tidak boleh 00");
  }

  return `WILAYAH:${kodeDolog}:${kodeSubdolog}`;
}
