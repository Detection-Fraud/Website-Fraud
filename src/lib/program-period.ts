export type ProgramWindow = {
  startDate: Date | string;
  endDate: Date | string;
  uploadDeadline: Date | string;
};

export function startOfLocalDay(value: Date | string) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isProgramUploadOpen(
  program: ProgramWindow & { isActive: boolean },
  now = new Date(),
) {
  const today = startOfLocalDay(now);
  return (
    program.isActive &&
    today >= startOfLocalDay(program.startDate) &&
    today <= startOfLocalDay(program.uploadDeadline)
  );
}

export function isActivityDateInsideProgram(
  activityDate: Date | string,
  program: Pick<ProgramWindow, "startDate" | "endDate">,
) {
  const date = startOfLocalDay(activityDate);
  return (
    date >= startOfLocalDay(program.startDate) &&
    date <= startOfLocalDay(program.endDate)
  );
}

export function programYearBounds(year: number) {
  return {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

export const TW_LABELS = ["", "TW I", "TW II", "TW III", "TW IV"];

export type PicDashboardPeriodStatus =
  | "ACTIVITY_ACTIVE"
  | "UPLOAD_OPEN"
  | "LATEST";

export interface PicDashboardPeriod {
  year: number;
  tw: number;
  label: string;
  status: PicDashboardPeriodStatus;
}

export interface PicDashboardPeriodCandidate {
  tw: number | null;
  startDate: Date | string;
  endDate: Date | string;
  uploadDeadline: Date | string;
}

interface ResolvePicDashboardPeriodsInput {
  openPrograms: PicDashboardPeriodCandidate[];
  fallbackProgram: PicDashboardPeriodCandidate | null;
  hasCurrentWindow?: boolean;
  requested?: { year: number; tw: number };
  now?: Date;
}

export function resolvePicDashboardPeriods({
  openPrograms,
  fallbackProgram,
  hasCurrentWindow = false,
  requested,
  now = new Date(),
}: ResolvePicDashboardPeriodsInput) {
  const today = startOfLocalDay(now);
  const grouped = new Map<
    string,
    PicDashboardPeriod & { latestStart: number }
  >();

  for (const program of openPrograms) {
    if (!program.tw) continue;

    const startDate = startOfLocalDay(program.startDate);
    const endDate = startOfLocalDay(program.endDate);
    const year = startDate.getFullYear();
    const key = `${year}-${program.tw}`;
    const current = grouped.get(key);
    const status: PicDashboardPeriodStatus =
      today >= startDate && today <= endDate
        ? "ACTIVITY_ACTIVE"
        : "UPLOAD_OPEN";

    grouped.set(key, {
      year,
      tw: program.tw,
      label: `${TW_LABELS[program.tw]} ${year}`,
      status:
        current?.status === "ACTIVITY_ACTIVE" ? "ACTIVITY_ACTIVE" : status,
      latestStart: Math.max(current?.latestStart ?? 0, startDate.getTime()),
    });
  }

  const periods = [...grouped.values()]
    .sort(
      (a, b) =>
        Number(b.status === "ACTIVITY_ACTIVE") -
          Number(a.status === "ACTIVITY_ACTIVE") ||
        b.latestStart - a.latestStart,
    )
    .map(({ year, tw, label, status }) => ({ year, tw, label, status }));

  const requestedPeriod = requested
    ? periods.find(
        (period) =>
          period.year === requested.year && period.tw === requested.tw,
      )
    : undefined;

  const fallbackPeriod =
    periods.length === 0 && !hasCurrentWindow && fallbackProgram?.tw
      ? {
          year: startOfLocalDay(fallbackProgram.startDate).getFullYear(),
          tw: fallbackProgram.tw,
          label: `${TW_LABELS[fallbackProgram.tw]} ${startOfLocalDay(
            fallbackProgram.startDate,
          ).getFullYear()}`,
          status: "LATEST" as const,
        }
      : null;

  return {
    periods,
    selectedPeriod: requestedPeriod ?? periods[0] ?? fallbackPeriod,
  };
}
