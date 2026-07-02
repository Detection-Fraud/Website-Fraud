import { prisma } from "../prisma";

export interface ScopeUser {
  role: string;
  unitId?: string | null;
  unitType?: string | null;
}

export async function getChildUnitIds(parentId: string): Promise<string[]> {
  const children = await prisma.unit.findMany({
    where: { parentId },
    select: { id: true },
  });
  return children.map((c) => c.id);
}

interface BuildUnitScopeParams {
  user: ScopeUser;
  kanwilId?: string | null;
  kancabId?: string | null;
  divisiId?: string | null;
}

type UnitScopeResult = Record<string, any>;

export async function buildUnitScope(
  params: BuildUnitScopeParams,
): Promise<UnitScopeResult> {
  const { user, kanwilId, kancabId, divisiId } = params;

  const kw = kanwilId && kanwilId !== "ALL" ? kanwilId : null;
  const kc = kancabId && kancabId !== "ALL" ? kancabId : null;
  const dv = divisiId && divisiId !== "ALL" ? divisiId : null;

  if (user.role === "ADMIN") {
    if (kc) return { unitId: kc };
    if (kw) {
      const childIds = await getChildUnitIds(kw);
      return { unitId: { in: [kw, ...childIds] } };
    }
    if (dv) return { unitId: dv };
    return {};
  }

  if (!user.unitId) {
    return { unitId: "BLOCKED" };
  }

  if (user.unitType === "KANTOR_WILAYAH") {
    const childIds = await getChildUnitIds(user.unitId);
    const scopeIds = [user.unitId, ...childIds];

    if (kc && scopeIds.includes(kc)) {
      return { unitId: kc };
    }

    return { unitId: { in: scopeIds } };
  }

  return { unitId: user.unitId };
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
