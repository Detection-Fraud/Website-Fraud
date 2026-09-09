export const PARTICIPATION_WORKBOOK_SHEET_KEYS = {
  SUMMARY: "SUMMARY",
  KANWIL: "KANWIL",
  KANCAB: "KANCAB",
  DIVISI: "DIVISI",
  INSTRUCTIONS_REFERENCE: "INSTRUCTIONS_REFERENCE",
} as const;

export type ParticipationWorkbookSheetKey =
  (typeof PARTICIPATION_WORKBOOK_SHEET_KEYS)[keyof typeof PARTICIPATION_WORKBOOK_SHEET_KEYS];

export const PARTICIPATION_WORKBOOK_SHEETS = {
  SUMMARY: "Summary",
  KANWIL: "Kanwil",
  KANCAB: "Kancab",
  DIVISI: "Divisi",
  INSTRUCTIONS_REFERENCE: "Instructions-Reference",
} as const satisfies Record<ParticipationWorkbookSheetKey, string>;

export const PARTICIPATION_WORKBOOK_SHEET_ALIASES = {
  SUMMARY: ["Summary", "Ringkasan"],
  KANWIL: ["Kanwil"],
  KANCAB: ["Kancab"],
  DIVISI: ["Divisi"],
  INSTRUCTIONS_REFERENCE: [
    "Instructions-Reference",
    "Instructions/Reference",
    "Petunjuk-Referensi",
  ],
} as const satisfies Record<ParticipationWorkbookSheetKey, readonly string[]>;

export const PARTICIPATION_WORKBOOK_HEADERS = [
  "No",
  "Kode Unit",
  "Unit Kerja",
  "Induk Unit Kerja",
  "Jumlah Karyawan",
  "Jumlah Partisipasi",
  "Persentase",
] as const;

export type ParticipationWorkbookHeader =
  (typeof PARTICIPATION_WORKBOOK_HEADERS)[number];

export const PARTICIPATION_WORKBOOK_TABLES = {
  SUMMARY: "SummaryTable",
  KANWIL: "KanwilTable",
  KANCAB: "KancabTable",
  DIVISI: "DivisiTable",
} as const satisfies Record<
  Exclude<ParticipationWorkbookSheetKey, "INSTRUCTIONS_REFERENCE">,
  string
>;

export const PARTICIPATION_WORKBOOK_INSTRUCTIONS = [
  "Petunjuk Pengisian Workbook Partisipasi",
  "Kode Unit adalah identifier unit dan tidak boleh diubah.",
  "Jumlah Karyawan diisi oleh sistem berdasarkan data Employee.",
  "Jumlah Partisipasi diisi oleh Admin.",
  "Persentase dihitung oleh backend berdasarkan Jumlah Partisipasi dan Jumlah Karyawan.",
  "Untuk periode historis, nama unit dan induk unit mengikuti snapshot historis.",
] as const;
