export type EmployeeEligibilityInput = {
  jenjang: string;
  kodeStatpeg: string;
  statKepeg: string;
  isPresentInSource: boolean;
};

export function isEmploymentActive(
  employee: EmployeeEligibilityInput,
): boolean {
  return employee.kodeStatpeg === "01" && employee.statKepeg === "02";
}

export function isPicEligible(employee: EmployeeEligibilityInput): boolean {
  return (
    (employee.jenjang === "4" || employee.jenjang === "5") &&
    isEmploymentActive(employee) &&
    employee.isPresentInSource
  );
}
