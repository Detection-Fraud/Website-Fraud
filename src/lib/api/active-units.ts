import { prisma } from "../prisma";

export interface ActiveUnit {
  id: string;
  name: string;
  type: string;
  wilayah: string;
  parentId?: string | null;
}

interface GetActiveUnitsParams {
  kanwilId: string;
  kancabId: string;
  divisiId: string;
  unitTypeFilter: string;

  user: {
    role: string;
    unitId?: string | null;
    unitType?: string | null;
  };
}

export async function getActiveUnits(
  params: GetActiveUnitsParams,
): Promise<ActiveUnit[]> {
  const { kanwilId, kancabId, divisiId, unitTypeFilter, user } = params;
  const hasPIC = { users: { some: { role: "PIC" as const } } };

  let activeUnits: ActiveUnit[] = [];

  // ── 1. Ambil unit yang aktif (memiliki PIC) berdasarkan filter ──
  if (divisiId !== "ALL") {
    const div = await prisma.unit.findFirst({
      where: { id: divisiId, type: "DIVISI", ...hasPIC },
    });
    if (div) {
      activeUnits.push({
        id: div.id,
        name: div.name,
        type: "DIVISI",
        wilayah: "Kantor Pusat",
      });
    }
  } else if (kancabId !== "ALL") {
    const kancab = await prisma.unit.findFirst({
      where: { id: kancabId, type: "KANTOR_CABANG", ...hasPIC },
      include: { parent: true },
    });
    if (kancab) {
      activeUnits.push({
        id: kancab.id,
        name: kancab.name,
        type: "KANTOR_CABANG",
        wilayah: kancab.parent?.name || "Unknown",
        parentId: kancab.parentId,
      });
    }
  } else if (kanwilId !== "ALL") {
    const kanwil = await prisma.unit.findFirst({
      where: { id: kanwilId, type: "KANTOR_WILAYAH", ...hasPIC },
    });
    const kancabs = await prisma.unit.findMany({
      where: { parentId: kanwilId, type: "KANTOR_CABANG", ...hasPIC },
      include: { parent: true },
    });
    
    if (kanwil) {
      activeUnits.push({
        id: kanwil.id,
        name: kanwil.name,
        type: "KANTOR_WILAYAH",
        wilayah: kanwil.name,
        parentId: kanwil.id,
      });
    }
    kancabs.forEach((b) =>
      activeUnits.push({
        id: b.id,
        name: b.name,
        type: "KANTOR_CABANG",
        wilayah: b.parent?.name || "Unknown",
        parentId: b.parentId,
      }),
    );
  } else {
    const units = await prisma.unit.findMany({
      where: hasPIC,
      include: { parent: true },
    });

    units.forEach((u) => {
      let wilayah = "";
      if (u.type === "DIVISI") wilayah = "Kantor Pusat";
      else if (u.type === "KANTOR_WILAYAH") wilayah = u.name;
      else if (u.type === "KANTOR_CABANG")
        wilayah = u.parent?.name || "Unknown";

      activeUnits.push({
        id: u.id,
        name: u.name,
        type: u.type,
        wilayah,
        parentId: u.parentId,
      });
    });
  }

  // ── 2. Terapkan batasan role ──
  if (user.role === "PIC" || user.role === "VIEWER") {
    if (user.unitId) {
      if (user.unitType === "KANTOR_WILAYAH") {
        activeUnits = activeUnits.filter(
          (u) => u.id === user.unitId || u.parentId === user.unitId,
        );
      } else {
        activeUnits = activeUnits.filter((u) => u.id === user.unitId);
      }
    }
  }

  // ── 3. Terapkan filter tipe unit ──
  if (unitTypeFilter === "KANWIL") {
    activeUnits = activeUnits.filter((u) => u.type === "KANTOR_WILAYAH");
  } else if (unitTypeFilter === "KANCAB") {
    activeUnits = activeUnits.filter((u) => u.type === "KANTOR_CABANG");
  } else if (unitTypeFilter === "DIVISI") {
    activeUnits = activeUnits.filter((u) => u.type === "DIVISI");
  } else if (unitTypeFilter === "KANWIL_AND_KANCAB") {
    activeUnits = activeUnits.filter(
      (u) => u.type === "KANTOR_WILAYAH" || u.type === "KANTOR_CABANG",
    );
  }

  return activeUnits;
}
