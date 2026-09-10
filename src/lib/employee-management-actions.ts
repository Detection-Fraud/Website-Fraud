import type { EmployeeAccount } from "@/types/user.types";
import { isEmploymentActive } from "@/lib/employee-eligibility";

export type EmployeeAdminAction =
  | "ENSURE_ADMIN"
  | "PROMOTE_VIEWER"
  | "ACTIVATE"
  | "DEACTIVATE"
  | "REVOKE_ADMIN";

export type EmployeeAdminReason =
  | "self"
  | "source"
  | "employment"
  | "provider"
  | "pic";

export type EmployeeManagementUnitType = "KANWIL" | "KANCAB" | "DIVISI";

export function getEmployeeAdminAction(
  employee: EmployeeAccount,
): EmployeeAdminAction | null {
  if (!employee.user) return "ENSURE_ADMIN";
  if (employee.user.authProvider !== "SSO") return null;
  if (employee.user.role !== "VIEWER" && employee.user.role !== "ADMIN") {
    return null;
  }
  if (employee.user.role === "VIEWER") return "PROMOTE_VIEWER";
  return employee.user.isActive ? "DEACTIVATE" : "ACTIVATE";
}

export function getEmployeeAdminActions(
  employee: EmployeeAccount,
  actorUserId?: string | null,
): EmployeeAdminAction[] {
  const primary = getEmployeeAdminAction(employee);
  if (!primary) return [];
  const actions: EmployeeAdminAction[] =
    employee.user?.role === "ADMIN" ? [primary, "REVOKE_ADMIN"] : [primary];

  if (employee.user?.id === actorUserId) {
    return actions.filter(
      (action) => action !== "DEACTIVATE" && action !== "REVOKE_ADMIN",
    );
  }

  return actions;
}

export function getEmployeeAdminReasons(
  employee: EmployeeAccount,
  actorUserId?: string | null,
): EmployeeAdminReason[] {
  const reasons: EmployeeAdminReason[] = [];
  if (employee.user?.id && employee.user.id === actorUserId)
    reasons.push("self");
  if (employee.user?.authProvider && employee.user.authProvider !== "SSO") {
    reasons.push("provider");
  }
  if (employee.user?.role === "PIC") reasons.push("pic");
  if (!employee.isPresentInSource) reasons.push("source");
  if (!isEmploymentActive(employee)) reasons.push("employment");
  return reasons;
}

export function getEmployeeAdminActionLabel(
  action: EmployeeAdminAction,
): string {
  return {
    ENSURE_ADMIN: "Buat akun ADMIN SSO",
    PROMOTE_VIEWER: "Promosikan ke ADMIN (tetap nonaktif)",
    ACTIVATE: "Aktifkan akun ADMIN",
    DEACTIVATE: "Nonaktifkan akun ADMIN",
    REVOKE_ADMIN: "Cabut role ADMIN",
  }[action];
}

export function getEmployeeAdminReasonLabel(
  reason: EmployeeAdminReason,
): string {
  return {
    self: "Akun Anda sendiri tidak dapat dinonaktifkan atau dicabut role-nya.",
    source: "Employee tidak ditemukan pada source terbaru.",
    employment: "Status kepegawaian Employee tidak aktif.",
    provider: "Akun provider bukan SSO.",
    pic: "Akun PIC dikelola read-only dari halaman Employee.",
  }[reason];
}

export function canExecuteEmployeeAdminAction(
  action: EmployeeAdminAction,
  reasons: EmployeeAdminReason[],
): boolean {
  if (
    action === "ACTIVATE" &&
    reasons.some((reason) => reason === "source" || reason === "employment")
  ) {
    return false;
  }
  if (
    (action === "DEACTIVATE" || action === "REVOKE_ADMIN") &&
    reasons.includes("self")
  ) {
    return false;
  }
  return !reasons.some((reason) => reason === "provider" || reason === "pic");
}

export function getEmployeePicManagementLink(
  employee: EmployeeAccount,
): string | null {
  if (
    employee.user?.role !== "PIC" ||
    !employee.user.unitId ||
    !employee.user.unit?.type
  ) {
    return null;
  }

  const params = new URLSearchParams({
    unitId: employee.user.unitId,
    nip: employee.nip,
  });

  params.set(
    "unitType",
    employee.user.unit.type === "KANTOR_WILAYAH"
      ? "KANWIL"
      : employee.user.unit.type === "KANTOR_CABANG"
        ? "KANCAB"
        : "DIVISI",
  );

  return `/admin/management?${params.toString()}`;
}

export function parseEmployeeManagementDeepLink(
  params: Pick<URLSearchParams, "get">,
): {
  unitId: string;
  nip: string;
  unitType: EmployeeManagementUnitType;
} | null {
  const unitId = params.get("unitId")?.trim();
  const nip = params.get("nip")?.trim();
  const unitType = params.get("unitType")?.trim();

  if (
    !unitId ||
    !nip ||
    (unitType !== "KANWIL" && unitType !== "KANCAB" && unitType !== "DIVISI")
  ) {
    return null;
  }
  return { unitId, nip, unitType };
}

export function getEmployeeManagementDeepLinkWarning(
  params: Pick<URLSearchParams, "get">,
): string | null {
  const unitId = params.get("unitId")?.trim();
  const nip = params.get("nip")?.trim();
  const unitType = params.get("unitType")?.trim();
  if (!unitId && !nip && !unitType) return null;
  if (
    !unitId ||
    !nip ||
    (unitType !== "KANWIL" && unitType !== "KANCAB" && unitType !== "DIVISI")
  ) {
    return "Deep-link Manajemen PIC tidak lengkap atau tidak valid; silakan pilih unit dan cari NIP secara manual.";
  }
  return null;
}
