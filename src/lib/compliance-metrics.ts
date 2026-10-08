export const MAX_COMPLIANCE_PERCENT = 120;

export function calculateProgramCompliancePercent(
  submitted: number,
  frequency: number,
) {
  if (frequency <= 0) return 0;
  return Math.min((submitted / frequency) * 100, MAX_COMPLIANCE_PERCENT);
}

export function averageCompliancePercent(percentages: number[]) {
  return percentages.length > 0
    ? percentages.reduce((sum, percentage) => sum + percentage, 0) /
        percentages.length
    : 0;
}

export function classifyCompliancePercent(percentage: number) {
  if (percentage >= 50) return "ON_TRACK";
  if (percentage >= 25) return "WATCH";
  return "AT_RISK";
}
