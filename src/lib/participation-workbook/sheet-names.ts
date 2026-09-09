import {
  PARTICIPATION_WORKBOOK_SHEET_ALIASES,
  PARTICIPATION_WORKBOOK_SHEET_KEYS,
  PARTICIPATION_WORKBOOK_SHEETS,
  type ParticipationWorkbookSheetKey,
} from "./constants";

export function normalizeWorkbookSheetName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function resolveParticipationWorkbookSheetKey(
  sheetName: string,
): ParticipationWorkbookSheetKey | null {
  const normalized = normalizeWorkbookSheetName(sheetName);

  for (const key of Object.values(PARTICIPATION_WORKBOOK_SHEET_KEYS)) {
    const aliases = PARTICIPATION_WORKBOOK_SHEET_ALIASES[key];

    if (
      aliases.some((alias) => normalizeWorkbookSheetName(alias) === normalized)
    ) {
      return key;
    }
  }

  return null;
}

export function getCanonicalParticipationWorkbookSheetName(
  key: ParticipationWorkbookSheetKey,
): string {
  return PARTICIPATION_WORKBOOK_SHEETS[key];
}
