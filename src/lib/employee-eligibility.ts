export type EmployeeEligibilityInput = {
  jenjang: string;
  kodeStatpeg: string;
  statKepeg: string;
  isPresentInSource: boolean;
};

export const PIC_ELIGIBLE_JENJANG_CODES = ["5", "6"] as const;

export function isEmploymentActive(
  employee: EmployeeEligibilityInput,
): boolean {
  return employee.kodeStatpeg === "01" && employee.statKepeg === "02";
}

export function isPicEligible(employee: EmployeeEligibilityInput): boolean {
  return (
    PIC_ELIGIBLE_JENJANG_CODES.some((code) => code === employee.jenjang) &&
    isEmploymentActive(employee) &&
    employee.isPresentInSource
  );
}
