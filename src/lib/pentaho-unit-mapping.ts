export const PENTAHO_SOURCE_SYSTEM = "PENTAHO" as const;
export const CANONICAL_LHOKSEUMAWE_ORG = "D00C00" as const;

export const FIXTURE_CENTRAL_ROOTS = new Set([
  "928000",
  "A3G000",
  "D15000",
  "D2A000",
  "D2B000",
  "D2C000",
  "D2F000",
  "D49000",
  "E00000",
  "E01000",
  "E02000",
  "E03000",
  "E04000",
  "E05000",
  "E10000",
  "E11000",
  "E12000",
  "E20000",
  "E21000",
  "E22000",
  "E23000",
  "E24000",
  "E30000",
  "E31000",
  "E32000",
  "E33000",
  "E40000",
  "E41000",
  "E42000",
  "E43000",
  "E44000",
  "E50000",
  "E51000",
  "E52000",
  "E53000",
  "E54000",
  "E55000",
  "E56000",
  "E57000",
  "E58000",
  "EA0000",
]);

export const CENTRAL_SOURCE_ALIASES: Readonly<Record<string, string>> = {
  "DIVISI:E10000": "DIVISI:E00000",
  "DIVISI:E20000": "DIVISI:E00000",
  "DIVISI:E30000": "DIVISI:E00000",
  "DIVISI:E40000": "DIVISI:E00000",
  "DIVISI:E50000": "DIVISI:E00000",
  "DIVISI:EA0000": "DIVISI:E00000",
};

export type MappingUnit = {
  id: string;
  type: "DIVISI" | "KANTOR_WILAYAH" | "KANTOR_CABANG";
  kodeDolog: string;
  kodeSubdolog: string;
  kodeOrg: string;
};

export type PlannedExternalMapping = {
  sourceSystem: typeof PENTAHO_SOURCE_SYSTEM;
  externalUnitCode: string;
  targetUnitId: string;
};

export function externalUnitCodeForUnit(unit: MappingUnit): string {
  const dolog = unit.kodeDolog.trim();
  const subdolog = unit.kodeSubdolog.trim();
  const kodeOrg = unit.kodeOrg.trim();

  if (unit.type === "DIVISI") {
    return `DIVISI:${kodeOrg}`;
  }

  if (dolog === "00") {
    throw new Error(`Regional Unit ${unit.id} has invalid KODE_DOLOG 00`);
  }

  return `WILAYAH:${dolog}:${subdolog}`;
}

export type SourceUnitPlacement = {
  kodeDolog: string;
  kodeSubdolog: string;
  kodeOrg: string;
};

function requireSourceCode(
  value: string,
  field: keyof SourceUnitPlacement,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${field} wajib diisi`);
  }

  if (!/^[A-Za-z0-9]+$/.test(normalized)) {
    throw new Error(`${field} memiliki format kode yang tidak valid`);
  }

  return normalized;
}

export function externalUnitCodeFromSource(
  placement: SourceUnitPlacement,
): string {
  const kodeDolog = requireSourceCode(placement.kodeDolog, "kodeDolog");
  const kodeSubdolog = requireSourceCode(
    placement.kodeSubdolog,
    "kodeSubdolog",
  );
  const kodeOrg = requireSourceCode(placement.kodeOrg, "kodeOrg");

  if (kodeDolog !== "00") {
    return `WILAYAH:${kodeDolog}:${kodeSubdolog}`;
  }

  if (kodeSubdolog !== "00") {
    throw new Error("KODE_SUBDOLOG harus 00 untuk placement central");
  }

  if (kodeOrg.length !== 6) {
    throw new Error("KODE_ORG central harus memiliki enam karakter");
  }

  return `DIVISI:${kodeOrg.slice(0, 3)}000`;
}

export function aliasTargetForSourceCode(
  externalUnitCode: string,
): string | undefined {
  return CENTRAL_SOURCE_ALIASES[externalUnitCode.trim()];
}

export function buildMappingPlan(
  units: MappingUnit[],
): PlannedExternalMapping[] {
  const directMappings = new Map<string, PlannedExternalMapping>();

  for (const unit of units) {
    const externalUnitCode = externalUnitCodeForUnit(unit);

    if (
      unit.type === "DIVISI" &&
      !FIXTURE_CENTRAL_ROOTS.has(unit.kodeOrg.trim())
    ) {
      continue;
    }

    const previous = directMappings.get(externalUnitCode);

    if (previous && previous.targetUnitId !== unit.id) {
      throw new Error(
        `Ambiguous externalUnitCode ${externalUnitCode}: ${previous.targetUnitId}, ${unit.id}`,
      );
    }

    directMappings.set(externalUnitCode, {
      sourceSystem: PENTAHO_SOURCE_SYSTEM,
      externalUnitCode,
      targetUnitId: unit.id,
    });
  }

  const e00 = units.filter(
    (unit) => unit.type === "DIVISI" && unit.kodeOrg.trim() === "E00000",
  );

  if (e00.length !== 1) {
    throw new Error(
      `Expected exactly one DIVISI E00000 Unit, found ${e00.length}`,
    );
  }

  for (const [externalUnitCode, targetExternalUnitCode] of Object.entries(
    CENTRAL_SOURCE_ALIASES,
  )) {
    directMappings.set(externalUnitCode, {
      sourceSystem: PENTAHO_SOURCE_SYSTEM,
      externalUnitCode,
      targetUnitId: e00[0].id,
    });

    if (!targetExternalUnitCode) {
      throw new Error(`Invalid alias target for ${externalUnitCode}`);
    }
  }

  return [...directMappings.values()].sort((a, b) =>
    a.externalUnitCode.localeCompare(b.externalUnitCode),
  );
}
