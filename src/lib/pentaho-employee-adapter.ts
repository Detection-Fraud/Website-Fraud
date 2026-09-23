import { ZodError } from "zod";
import {
  externalUnitCodeFromSource,
  PENTAHO_SOURCE_SYSTEM,
} from "./pentaho-unit-mapping";
import {
  parseEmployeeSnapshot,
  type NormalizedEmployee,
  type NormalizedEmployeeSnapshot,
} from "./employee-sync-contract";

export const PENTAHO_EMPLOYEE_HEADERS = [
  "NIP",
  "NAMA",
  "JAB_LKP",
  "KODE_STATPEG",
  "STAT_KEPEG",
  "KODE_DOLOG",
  "KODE_SUBDOLOG",
  "KODE_KANSILOG",
  "KODE_GUDANG",
  "KODE_ORG",
  "JENJANG",
  "NAMA_ORG",
  "NAMA_SATKER",
  "NAMA_INDUK",
  "CREATED_AT",
  "CREATED_BY",
  "UPDATED_AT",
  "UPDATED_BY",
] as const;

export type PentahoRawRow = Readonly<
  Record<string, unknown>
>;

export type PentahoValidationIssue = {
  rowNumber?: number;
  field?: string;
  code: string;
  message: string;
};

export class PentahoEmployeeAdapterError extends Error {
  readonly issues: readonly PentahoValidationIssue[];

  constructor(issues: PentahoValidationIssue[]) {
    super(
      issues
        .map((issue) => {
          const row = issue.rowNumber
            ? `row ${issue.rowNumber}`
            : "header";

          const field = issue.field
            ? `.${issue.field}`
            : "";

          return `${row}${field}: ${issue.message}`;
        })
        .join("; "),
    );

    this.name = "PentahoEmployeeAdapterError";
    this.issues = issues;
  }
}

function issue(
  rowNumber: number | undefined,
  field: string | undefined,
  code: string,
  message: string,
): never {
  throw new PentahoEmployeeAdapterError([
    {
      rowNumber,
      field,
      code,
      message,
    },
  ]);
}

function normalizeHeader(
  value: unknown,
  index: number,
): string {
  if (typeof value !== "string") {
    issue(
      undefined,
      undefined,
      "INVALID_HEADER",
      `Header indeks ${index + 1} harus berupa string`,
    );
  }

  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    issue(
      undefined,
      undefined,
      "INVALID_HEADER",
      `Header indeks ${index + 1} kosong`,
    );
  }

  return normalized;
}

export function validatePentahoHeaders(
  headers: readonly unknown[],
): string[] {
  const normalizedHeaders = headers.map(normalizeHeader);
  const requiredHeaders = [...PENTAHO_EMPLOYEE_HEADERS];

  const duplicateHeaders = normalizedHeaders.filter(
    (header, index) =>
      normalizedHeaders.indexOf(header) !== index,
  );

  const unknownHeaders = normalizedHeaders.filter(
    (header) => !requiredHeaders.includes(
      header as (typeof PENTAHO_EMPLOYEE_HEADERS)[number],
    ),
  );

  const missingHeaders = requiredHeaders.filter(
    (header) => !normalizedHeaders.includes(header),
  );

  const issues: PentahoValidationIssue[] = [];

  for (const header of [
    ...new Set(duplicateHeaders),
  ]) {
    issues.push({
      code: "DUPLICATE_HEADER",
      field: header,
      message: `Header duplikat: ${header}`,
    });
  }

  for (const header of [
    ...new Set(unknownHeaders),
  ]) {
    issues.push({
      code: "UNKNOWN_HEADER",
      field: header,
      message: `Header tidak dikenal: ${header}`,
    });
  }

  for (const header of missingHeaders) {
    issues.push({
      code: "MISSING_HEADER",
      field: header,
      message: `Header wajib tidak ditemukan: ${header}`,
    });
  }

  if (issues.length > 0) {
    throw new PentahoEmployeeAdapterError(issues);
  }

  return normalizedHeaders;
}

function requiredText(
  row: PentahoRawRow,
  field: string,
  rowNumber: number,
): string {
  const value = row[field];

  if (typeof value !== "string") {
    issue(
      rowNumber,
      field,
      "SOURCE_VALUE_NOT_STRING",
      "Nilai source harus berupa string",
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    issue(
      rowNumber,
      field,
      "REQUIRED_VALUE_EMPTY",
      "Nilai wajib tidak boleh kosong",
    );
  }

  return normalized;
}

function optionalParentName(
  row: PentahoRawRow,
  rowNumber: number,
): string | null {
  const value = row.NAMA_INDUK;

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    issue(
      rowNumber,
      "NAMA_INDUK",
      "SOURCE_VALUE_NOT_STRING",
      "Nilai source harus berupa string",
    );
  }

  const normalized = value.trim();

  return normalized || null;
}

function parseJenjang(
  source: string,
  rowNumber: number,
): {
  jenjang: string;
  jenjangLabel: string;
} {
  const dotIndex = source.indexOf(".");

  if (dotIndex <= 0 || dotIndex === source.length - 1) {
    issue(
      rowNumber,
      "JENJANG",
      "INVALID_JENJANG",
      "JENJANG harus memiliki format kode titik label",
    );
  }

  const code = source.slice(0, dotIndex).trim();
  const label = source.trim();

  if (!/^[0-9]+$/.test(code)) {
    issue(
      rowNumber,
      "JENJANG",
      "INVALID_JENJANG",
      "Kode JENJANG harus numerik dan tidak boleh dikonversi ke number",
    );
  }

  if (!label.slice(dotIndex + 1).trim()) {
    issue(
      rowNumber,
      "JENJANG",
      "INVALID_JENJANG",
      "Label JENJANG tidak boleh kosong",
    );
  }

  return {
    jenjang: code,
    jenjangLabel: label,
  };
}

function parseTimestamp(
  value: string,
  field: string,
  rowNumber: number,
): Date {
  const isoWithTimezone =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

  const match = isoWithTimezone.exec(value);

  if (!match) {
    issue(
      rowNumber,
      field,
      "INVALID_TIMESTAMP",
      "Timestamp harus ISO-8601 dengan timezone",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  const daysInMonth = new Date(
    Date.UTC(year, month, 0),
  ).getUTCDate();

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    issue(
      rowNumber,
      field,
      "INVALID_TIMESTAMP",
      "Timestamp bukan tanggal atau waktu kalender yang valid",
    );
  }

  const timezone = match[7];

  if (
    timezone !== "Z" &&
    !/^[+-](?:0\d|1\d|2[0-3]):[0-5]\d$/.test(timezone)
  ) {
    issue(
      rowNumber,
      field,
      "INVALID_TIMESTAMP",
      "Timezone timestamp tidak valid",
    );
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    issue(
      rowNumber,
      field,
      "INVALID_TIMESTAMP",
      "Timestamp tidak valid",
    );
  }

  return parsed;
}

function normalizeRow(
  row: PentahoRawRow,
  rowNumber: number,
): NormalizedEmployee {
  const nip = requiredText(row, "NIP", rowNumber);
  const name = requiredText(row, "NAMA", rowNumber);
  const jobTitle = requiredText(row, "JAB_LKP", rowNumber);
  const kodeStatpeg = requiredText(
    row,
    "KODE_STATPEG",
    rowNumber,
  );
  const statKepeg = requiredText(
    row,
    "STAT_KEPEG",
    rowNumber,
  );
  const kodeDolog = requiredText(
    row,
    "KODE_DOLOG",
    rowNumber,
  );
  const kodeSubdolog = requiredText(
    row,
    "KODE_SUBDOLOG",
    rowNumber,
  );
  const kodeKansilog = requiredText(
    row,
    "KODE_KANSILOG",
    rowNumber,
  );
  const kodeGudang = requiredText(
    row,
    "KODE_GUDANG",
    rowNumber,
  );
  const kodeOrg = requiredText(
    row,
    "KODE_ORG",
    rowNumber,
  );
  const jenjangSource = requiredText(
    row,
    "JENJANG",
    rowNumber,
  );
  const sourceNamaOrg = requiredText(
    row,
    "NAMA_ORG",
    rowNumber,
  );
  const sourceNamaSatker = requiredText(
    row,
    "NAMA_SATKER",
    rowNumber,
  );
  const sourceCreatedBy = requiredText(
    row,
    "CREATED_BY",
    rowNumber,
  );
  const sourceUpdatedBy = requiredText(
    row,
    "UPDATED_BY",
    rowNumber,
  );
  const sourceCreatedAt = parseTimestamp(
    requiredText(row, "CREATED_AT", rowNumber),
    "CREATED_AT",
    rowNumber,
  );
  const sourceUpdatedAt = parseTimestamp(
    requiredText(row, "UPDATED_AT", rowNumber),
    "UPDATED_AT",
    rowNumber,
  );

  if (
    sourceUpdatedAt.getTime() <
    sourceCreatedAt.getTime()
  ) {
    issue(
      rowNumber,
      "UPDATED_AT",
      "INVALID_TIMESTAMP_ORDER",
      "UPDATED_AT tidak boleh lebih awal dari CREATED_AT",
    );
  }

  const { jenjang, jenjangLabel } = parseJenjang(
    jenjangSource,
    rowNumber,
  );

  let externalUnitCode: string;

  try {
    externalUnitCode = externalUnitCodeFromSource({
      kodeDolog,
      kodeSubdolog,
      kodeOrg,
    });
  } catch (error) {
    issue(
      rowNumber,
      "KODE_ORG",
      "INVALID_UNIT_CODE",
      error instanceof Error
        ? error.message
        : "External Unit code tidak dapat diturunkan",
    );
  }

  return {
    nip,
    name,
    jobTitle,
    jenjang,
    jenjangLabel,
    kodeStatpeg,
    statKepeg,
    sourceKodeDolog: kodeDolog,
    sourceKodeSubdolog: kodeSubdolog,
    sourceKodeKansilog: kodeKansilog,
    sourceKodeGudang: kodeGudang,
    sourceKodeOrg: kodeOrg,
    sourceNamaOrg,
    sourceNamaSatker,
    sourceNamaInduk: optionalParentName(
      row,
      rowNumber,
    ),
    sourceCreatedAt,
    sourceCreatedBy,
    sourceUpdatedAt,
    sourceUpdatedBy,
    externalUnitCode,
  };
}

export function adaptPentahoEmployeeBatch(
  headers: readonly unknown[],
  rows: readonly PentahoRawRow[],
): NormalizedEmployeeSnapshot {
  const normalizedHeaders = validatePentahoHeaders(
    headers,
  );

  const issues: PentahoValidationIssue[] = [];
  const normalizedRows: NormalizedEmployee[] = [];
  const seenNips = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowKeys = Object.keys(row).map((key) =>
      key.trim().toUpperCase(),
    );
    const unknownRowKeys = rowKeys.filter(
      (key) => !normalizedHeaders.includes(key),
    );

    if (unknownRowKeys.length > 0) {
      issues.push({
        rowNumber,
        code: "UNKNOWN_ROW_FIELD",
        message: `Field row tidak dikenal: ${[
          ...new Set(unknownRowKeys),
        ].join(", ")}`,
      });

      return;
    }

    try {
      const normalized = normalizeRow(row, rowNumber);
      const firstRow = seenNips.get(normalized.nip);

      if (firstRow !== undefined) {
        issues.push({
          rowNumber,
          field: "NIP",
          code: "DUPLICATE_NIP",
          message: `NIP duplikat; baris pertama berada pada baris ${firstRow}`,
        });

        return;
      }

      seenNips.set(normalized.nip, rowNumber);
      normalizedRows.push(normalized);
    } catch (error) {
      if (error instanceof PentahoEmployeeAdapterError) {
        issues.push(...error.issues);
      } else {
        issues.push({
          rowNumber,
          code: "INVALID_ROW",
          message: "Row Pentaho tidak valid",
        });
      }
    }
  });

  if (issues.length > 0) {
    throw new PentahoEmployeeAdapterError(issues);
  }

  try {
    return parseEmployeeSnapshot({
      sourceSystem: PENTAHO_SOURCE_SYSTEM,
      employees: normalizedRows,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new PentahoEmployeeAdapterError(
        error.issues.map((zodIssue) => ({
          field: zodIssue.path.join("."),
          code: "NORMALIZED_CONTRACT_INVALID",
          message: zodIssue.message,
        })),
      );
    }

    throw error;
  }
}