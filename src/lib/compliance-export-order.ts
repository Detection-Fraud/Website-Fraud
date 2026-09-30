import type { ActiveUnit } from "@/lib/api/unit-scope";

export interface ComplianceExportUnit extends ActiveUnit {
  kodeDolog: string;
  kodeSubdolog: string;
  kodeOrg: string;
}

export interface ComplianceExportUnitGroup {
  root: ComplianceExportUnit | null;
  children: ComplianceExportUnit[];
}

const compareText = (left: string, right: string) =>
  left.localeCompare(right, "en-US");

function compareNameAndId(a: ComplianceExportUnit, b: ComplianceExportUnit) {
  return compareText(a.name, b.name) || compareText(a.id, b.id);
}

export function groupComplianceUnits(
  units: ComplianceExportUnit[],
): ComplianceExportUnitGroup[] {
  const kanwils = units
    .filter((unit) => unit.type === "KANTOR_WILAYAH")
    .sort((a, b) => compareText(a.kodeDolog, b.kodeDolog) || compareNameAndId(a, b));
  const kancabs = units.filter((unit) => unit.type === "KANTOR_CABANG");
  const divisis = units
    .filter((unit) => unit.type === "DIVISI")
    .sort((a, b) => compareText(a.kodeOrg, b.kodeOrg) || compareNameAndId(a, b));
  const kanwilIds = new Set(kanwils.map((unit) => unit.id));

  const groups: ComplianceExportUnitGroup[] = kanwils.map((kanwil) => ({
    root: kanwil,
    children: kancabs
      .filter((unit) => unit.parentId === kanwil.id)
      .sort((a, b) => compareText(a.kodeSubdolog, b.kodeSubdolog) || compareNameAndId(a, b)),
  }));

  const orphans = kancabs
    .filter((unit) => !unit.parentId || !kanwilIds.has(unit.parentId))
    .sort(
      (a, b) =>
        compareText(a.kodeDolog, b.kodeDolog) ||
        compareText(a.kodeSubdolog, b.kodeSubdolog) ||
        compareNameAndId(a, b),
    );

  if (orphans.length > 0) groups.push({ root: null, children: orphans });
  groups.push(...divisis.map((unit) => ({ root: unit, children: [] })));
  return groups;
}
