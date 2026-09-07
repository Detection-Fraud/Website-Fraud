import { Prisma } from "@generated/prisma";
import { prisma } from "../prisma";

export interface ScopeUser {
  role: string;
  unitId?: string | null;
  unitType?: string | null;
}

export interface ScopeFilters {
  kanwilId?: string | null;
  kancabId?: string | null;
  divisiId?: string | null;
  unitTypeFilter?: string;
}

export interface ActiveUnit {
  id: string;
  name: string;
  type: string;
  wilayah: string;
  parentId?: string | null;
}

export interface ResolvedScope {
  whereClause: Prisma.ActivityReportWhereInput;
  activeUnits: ActiveUnit[];
}

export async function resolveScope(
  user: ScopeUser,
  filters: ScopeFilters,
): Promise<ResolvedScope> {
  const { kanwilId, kancabId, divisiId, unitTypeFilter } = filters;

  const kw = kanwilId && kanwilId !== "ALL" ? kanwilId : null;
  const kc = kancabId && kancabId !== "ALL" ? kancabId : null;
  const dv = divisiId && divisiId !== "ALL" ? divisiId : null;

  let scopeUnitIds: string[] | null = null;

  if (user.role === "ADMIN") {
    if (kc) {
      scopeUnitIds = [kc];
    } else if (kw) {
      const childIds = await getChildUnitIds(kw);
      scopeUnitIds = [kw, ...childIds];
    } else if (dv) {
      scopeUnitIds = [dv];
    }
  } else if (user.unitId) {
    if (user.unitType === "KANTOR_WILAYAH") {
      const childIds = await getChildUnitIds(user.unitId);
      const allScopeIds = [user.unitId, ...childIds];

      const requestedUnitIds = [kw, kc, dv].filter(
        (id): id is string => Boolean(id),
      );
      const hasUnauthorizedFilter = requestedUnitIds.some(
        (id) => !allScopeIds.includes(id),
      );
      const hasContradictoryFilter =
        Boolean(kc && kw && !childIds.includes(kc)) || Boolean((kw || kc) && dv);

      if (hasUnauthorizedFilter || hasContradictoryFilter) {
        scopeUnitIds = ["BLOCKED"];
      } else if (kc) {
        scopeUnitIds = [kc];
      } else {
        scopeUnitIds = allScopeIds;
      }
    } else {
      const requestedUnitIds = [kw, kc, dv].filter(
        (id): id is string => Boolean(id),
      );
      scopeUnitIds = requestedUnitIds.every((id) => id === user.unitId)
        ? [user.unitId]
        : ["BLOCKED"];
    }
  } else {
    scopeUnitIds = ["BLOCKED"];
  }

  const whereClause: Prisma.ActivityReportWhereInput =
    scopeUnitIds === null
      ? {}
      : scopeUnitIds.length === 1
        ? { unitId: scopeUnitIds[0] }
        : { unitId: { in: scopeUnitIds } };

  let activeUnits: ActiveUnit[] = [];

  if (scopeUnitIds === null) {
    const units = await prisma.unit.findMany({
      where: {
        users: { some: { role: "PIC", authProvider: "SSO", isActive: true } },
      },
      include: { parent: true },
    });
    activeUnits = units.map((u) => ({
      id: u.id,
      name: u.name,
      type: u.type,
      wilayah:
        u.type === "DIVISI"
          ? "Kantor Pusat"
          : u.type === "KANTOR_WILAYAH"
            ? u.name
            : u.parent?.name || "Unknown",
      parentId: u.parentId,
    }));
  } else {
    const units = await prisma.unit.findMany({
      where: {
        id: { in: scopeUnitIds.filter((id) => id !== "BLOCKED") },
        users: {
          some: { role: "PIC", authProvider: "SSO", isActive: true },
        },
      },
      include: { parent: true },
    });
    activeUnits = units.map((u) => ({
      id: u.id,
      name: u.name,
      type: u.type,
      wilayah:
        u.type === "DIVISI"
          ? "Kantor Pusat"
          : u.type === "KANTOR_WILAYAH"
            ? u.name
            : u.parent?.name || "Unknown",
      parentId: u.parentId,
    }));
  }

  if (unitTypeFilter && unitTypeFilter !== "NASIONAL") {
    const TYPE_MAP: Record<string, string> = {
      KANWIL: "KANTOR_WILAYAH",
      KANCAB: "KANTOR_CABANG",
      DIVISI: "DIVISI",
      KANWIL_AND_KANCAB: "", // special case
    };

    if (unitTypeFilter === "KANWIL_AND_KANCAB") {
      activeUnits = activeUnits.filter(
        (u) => u.type === "KANTOR_WILAYAH" || u.type === "KANTOR_CABANG",
      );
    } else if (TYPE_MAP[unitTypeFilter]) {
      activeUnits = activeUnits.filter(
        (u) => u.type === TYPE_MAP[unitTypeFilter],
      );
    }
  }

  return { whereClause, activeUnits };
}

export async function getAuthorizedUnitIds(
  user: ScopeUser,
): Promise<string[] | null> {
  if (user.role === "ADMIN") {
    return null;
  }

  if (!user.unitId) {
    return [];
  }

  if (user.unitType === "KANTOR_WILAYAH") {
    const childIds = await getChildUnitIds(user.unitId);
    return [user.unitId, ...childIds];
  }

  return [user.unitId];
}

export async function getChildUnitIds(parentId: string): Promise<string[]> {
  const children = await prisma.unit.findMany({
    where: { parentId },
    select: { id: true },
  });
  return children.map((c) => c.id);
}

export function checkReportAccess(
  user: ScopeUser,
  report: {
    unitId: string | null;
    unit?: { parentId: string | null } | null;
  },
): boolean {
  if (!user.unitId) return false;

  if (user.unitType === "KANTOR_WILAYAH") {
    return (
      report.unitId === user.unitId || report.unit?.parentId === user.unitId
    );
  }

  return report.unitId === user.unitId;
}
