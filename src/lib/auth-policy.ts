import {
  isEmploymentActive,
  isPicEligible,
  type EmployeeEligibilityInput,
} from "./employee-eligibility";

export type AuthProvider = "SSO" | "LOCAL";

export type AuthPolicyEmployee = EmployeeEligibilityInput & {
  unitId: string | null;
};

export type AuthPolicyUser = {
  role: string;
  authProvider: string;
  isActive: boolean;
  unitId: string | null;
};

export type AuthPolicyInput = {
  provider: AuthProvider;
  user: AuthPolicyUser;
  employee?: AuthPolicyEmployee | null;
};

export type AuthPolicyRejection =
  | "inactive_user"
  | "provider_mismatch"
  | "unsupported_role"
  | "employee_required"
  | "employee_not_present_in_source"
  | "employment_inactive"
  | "pic_ineligible"
  | "user_unit_required"
  | "unit_mismatch";

export type AuthPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: AuthPolicyRejection };

function reject(reason: AuthPolicyRejection): AuthPolicyDecision {
  return { allowed: false, reason };
}

/**
 * Canonical server-side authorization policy for authenticated users.
 *
 * The caller supplies the provider used for this authentication attempt.
 * Persisted authProvider must match it exactly; provider mismatch fails closed.
 */
export function evaluateAuthPolicy({
  provider,
  user,
  employee = null,
}: AuthPolicyInput): AuthPolicyDecision {
  if (!user.isActive) return reject("inactive_user");
  if (user.authProvider !== provider) return reject("provider_mismatch");

  if (user.role === "VIEWER") return reject("unsupported_role");
  if (user.role !== "ADMIN" && user.role !== "PIC") {
    return reject("unsupported_role");
  }

  if (user.role === "ADMIN" && provider === "LOCAL") {
    return { allowed: true };
  }

  if (user.role === "PIC" && !user.unitId) {
    return reject("user_unit_required");
  }

  if (user.role === "PIC" && provider === "LOCAL") {
    return { allowed: true };
  }

  if (!employee) return reject("employee_required");

  if (!employee.isPresentInSource) {
    return reject("employee_not_present_in_source");
  }

  if (user.role === "ADMIN" && provider === "SSO") {
    return isEmploymentActive(employee)
      ? { allowed: true }
      : reject("employment_inactive");
  }

  if (user.role === "PIC" && provider === "SSO") {
    if (!isPicEligible(employee)) return reject("pic_ineligible");
    return employee.unitId === user.unitId
      ? { allowed: true }
      : reject("unit_mismatch");
  }

  return reject("provider_mismatch");
}
