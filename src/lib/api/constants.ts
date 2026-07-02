export const PROGRAM_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export const MONTHS_NAMES_ID = [
  "JANUARI",
  "FEBRUARI",
  "MARET",
  "APRIL",
  "MEI",
  "JUNI",
  "JULI",
  "AGUSTUS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DESEMBER",
];

export const PERIODE_CONFIG = {
  "TW I": { months: [1, 2, 3], divisor: 4 },
  "TW II": { months: [4, 5, 6], divisor: 4 },
  "TW III": { months: [7, 8, 9], divisor: 4 },
  "TW IV": { months: [10, 11, 12], divisor: 4 },
  "SEMESTER I": { months: [1, 2, 3, 4, 5, 6], divisor: 2 },
  "SEMESTER II": { months: [7, 8, 9, 10, 11, 12], divisor: 2 },
} as const;

export type PeriodeName = keyof typeof PERIODE_CONFIG;

export function getApprovalStatusText(rate: number): string {
  if (rate >= 90) return "Sangat Baik";
  if (rate >= 80) return "Baik";
  if (rate >= 70) return "Cukup";
  return "Perlu Perhatian";
}

export function getMonthRange(periode: string): {
  startMonth: number;
  endMonth: number;
} {
  switch (periode) {
    case "TW1":
      return { startMonth: 0, endMonth: 2 };
    case "TW2":
      return { startMonth: 3, endMonth: 5 };
    case "TW3":
      return { startMonth: 6, endMonth: 8 };
    case "TW4":
      return { startMonth: 9, endMonth: 11 };
    case "SM1":
      return { startMonth: 0, endMonth: 5 };
    case "SM2":
      return { startMonth: 6, endMonth: 11 };
    case "ALL":
    default:
      return { startMonth: 0, endMonth: 11 };
  }
}
