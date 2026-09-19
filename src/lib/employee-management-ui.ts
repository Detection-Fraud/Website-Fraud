import { EmployeeAccount } from "@/types/user.types";

export type EmployeeUiFlag =
  | "SOURCE_ABSENT"
  | "EMPLOYMENT_INACTIVE"
  | "ACCOUNT_UNLINKED"
  | "ACCOUNT_INACTIVE"
  | "UNIT_SCOPE_MISMATCH";

export interface EmployeeUiSummary {
  flags: EmployeeUiFlag[];
  hasReviewFlag: boolean;
  unitScopeMismatch: boolean;
}

export function summarizeEmployeeUi(
  employee: EmployeeAccount,
): EmployeeUiSummary {
  const flags: EmployeeUiFlag[] = [];

  if (!employee.isPresentInSource) flags.push("SOURCE_ABSENT");
  if (!employee.employmentActive) flags.push("EMPLOYMENT_INACTIVE");

  if (employee.user === null) {
    flags.push("ACCOUNT_UNLINKED");
  } else if (!employee.user.isActive) {
    flags.push("ACCOUNT_INACTIVE");
  }

  const unitScopeMismatch =
    employee.unitId !== null &&
    employee.user !== null &&
    employee.user.unitId !== null &&
    employee.unitId !== employee.user.unitId;

  if (unitScopeMismatch) flags.push("UNIT_SCOPE_MISMATCH");

  return {
    flags,
    hasReviewFlag: flags.some((flag) => flag !== "ACCOUNT_UNLINKED"),
    unitScopeMismatch,
  };
}
