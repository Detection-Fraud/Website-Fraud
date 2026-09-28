import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  adaptPentahoEmployeeBatch,
  PENTAHO_EMPLOYEE_HEADERS,
  PentahoEmployeeAdapterError,
} from "./pentaho-employee-adapter";
import { externalUnitCodeFromSource } from "./pentaho-unit-mapping";

const CORE_HEADERS = PENTAHO_EMPLOYEE_HEADERS.slice(0, 14);

const VALID_ROW = {
  NIP: "068006051",
  NAMA: "  Budi Santoso  ",
  JAB_LKP: "  Staff  ",
  KODE_STATPEG: "01",
  STAT_KEPEG: "02",
  KODE_DOLOG: "01",
  KODE_SUBDOLOG: "01",
  KODE_KANSILOG: "01",
  KODE_GUDANG: "12",
  KODE_ORG: "D00C00",
  JENJANG: "01. Wakil Dirut",
  NAMA_ORG: "  KANTOR CABANG LHOKSEUMAWE  ",
  NAMA_SATKER: "  KANTOR WILAYAH ACEH  ",
  NAMA_INDUK: "   ",
  CREATED_AT: "2026-01-01T00:00:00.000Z",
  CREATED_BY: "  pentaho-user  ",
  UPDATED_AT: "2026-01-02T00:00:00.000Z",
  UPDATED_BY: "  pentaho-user-2  ",
} as const;

function expectAdapterError(
  action: () => unknown,
): PentahoEmployeeAdapterError {
  let caught: unknown;

  try {
    action();
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof PentahoEmployeeAdapterError);
  return caught;
}

function fixturePath(): string {
  const candidates = [
    process.env.PENTAHO_FIXTURE_PATH,
    path.resolve(
      process.cwd(),
      "data/struktur data untuk pentaho.xlsx",
    ),
    "C:/Users/ASUS/Downloads/struktur data untuk pentaho.xlsx",
  ].filter((value): value is string => Boolean(value));

  const resolved = candidates.find((candidate) =>
    fs.existsSync(candidate),
  );

  if (!resolved) {
    throw new Error(
      `Pentaho fixture tidak ditemukan. Set PENTAHO_FIXTURE_PATH. Dicari: ${candidates.join(", ")}`,
    );
  }

  return resolved;
}

test("exact 18-column production headers are accepted", () => {
  const snapshot = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    [VALID_ROW],
  );

  assert.equal(snapshot.sourceSystem, "PENTAHO");
  assert.equal(snapshot.employees.length, 1);
});

test("14-column core fixture reports exactly four missing audit headers", () => {
  const error = expectAdapterError(() =>
    adaptPentahoEmployeeBatch(CORE_HEADERS, []),
  );

  assert.deepEqual(
    error.issues
      .filter((issue) => issue.code === "MISSING_HEADER")
      .map((issue) => issue.field),
    [
      "CREATED_AT",
      "CREATED_BY",
      "UPDATED_AT",
      "UPDATED_BY",
    ],
  );
});

test("unknown and duplicate headers use strict error codes", () => {
  const unknownError = expectAdapterError(() =>
    adaptPentahoEmployeeBatch(
      [...PENTAHO_EMPLOYEE_HEADERS, "EXTRA_FIELD"],
      [],
    ),
  );

  assert.ok(
    unknownError.issues.some(
      (issue) =>
        issue.code === "UNKNOWN_HEADER" &&
        issue.field === "EXTRA_FIELD",
    ),
  );

  const duplicateError = expectAdapterError(() =>
    adaptPentahoEmployeeBatch(
      [...PENTAHO_EMPLOYEE_HEADERS, "NIP"],
      [],
    ),
  );

  assert.ok(
    duplicateError.issues.some(
      (issue) =>
        issue.code === "DUPLICATE_HEADER" &&
        issue.field === "NIP",
    ),
  );
});

test("leading-zero and alphanumeric NIP values remain strings", () => {
  const leadingZero = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    [VALID_ROW],
  );

  const alphanumeric = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    [
      {
        ...VALID_ROW,
        NIP: "NR7805013",
      },
    ],
  );

  assert.equal(leadingZero.employees[0].nip, "068006051");
  assert.equal(typeof leadingZero.employees[0].nip, "string");
  assert.equal(alphanumeric.employees[0].nip, "NR7805013");
  assert.equal(typeof alphanumeric.employees[0].nip, "string");
});

test("source codes remain strings and text values are trimmed", () => {
  const employee = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    [VALID_ROW],
  ).employees[0];

  assert.equal(employee.name, "Budi Santoso");
  assert.equal(employee.jobTitle, "Staff");
  assert.equal(employee.sourceKodeDolog, "01");
  assert.equal(employee.sourceKodeSubdolog, "01");
  assert.equal(employee.sourceKodeKansilog, "01");
  assert.equal(employee.sourceKodeGudang, "12");
  assert.equal(employee.sourceKodeOrg, "D00C00");
  assert.equal(employee.sourceNamaOrg, "KANTOR CABANG LHOKSEUMAWE");
  assert.equal(employee.sourceNamaSatker, "KANTOR WILAYAH ACEH");

  for (const value of [
    employee.sourceKodeDolog,
    employee.sourceKodeSubdolog,
    employee.sourceKodeKansilog,
    employee.sourceKodeGudang,
    employee.sourceKodeOrg,
  ]) {
    assert.equal(typeof value, "string");
  }
});

test("blank NAMA_INDUK becomes null", () => {
  const employee = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    [VALID_ROW],
  ).employees[0];

  assert.equal(employee.sourceNamaInduk, null);
});

test("all ten fixture JENJANG labels normalize", () => {
  const labels = [
    "0. Direktur Utama",
    "01. Wakil Dirut",
    "02. Direksi",
    "1. Jenjang Utama",
    "2. Jenjang I",
    "3. Jenjang II",
    "4. Jenjang III",
    "5. Jenjang IV",
    "6. Jenjang V",
    "7. Non Jenjang",
  ];

  const snapshot = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    labels.map((label, index) => ({
      ...VALID_ROW,
      NIP: `NIP-${index}`,
      JENJANG: label,
    })),
  );

  assert.deepEqual(
    snapshot.employees.map((employee) => ({
      jenjang: employee.jenjang,
      jenjangLabel: employee.jenjangLabel,
    })),
    labels.map((label) => ({
      jenjang: label.split(".")[0],
      jenjangLabel: label,
    })),
  );
});

test("01 and 02 JENJANG codes preserve leading zeroes", () => {
  const snapshot = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    [
      {
        ...VALID_ROW,
        NIP: "NIP-01",
        JENJANG: "01. Wakil Dirut",
      },
      {
        ...VALID_ROW,
        NIP: "NIP-02",
        JENJANG: "02. Direksi",
      },
    ],
  );

  assert.equal(snapshot.employees[0].jenjang, "01");
  assert.equal(snapshot.employees[1].jenjang, "02");
});

test("malformed JENJANG is rejected", () => {
  const error = expectAdapterError(() =>
    adaptPentahoEmployeeBatch(
      PENTAHO_EMPLOYEE_HEADERS,
      [
        {
          ...VALID_ROW,
          JENJANG: "Jenjang III",
        },
      ],
    ),
  );

  assert.ok(
    error.issues.some(
      (issue) =>
        issue.code === "INVALID_JENJANG" &&
        issue.field === "JENJANG",
    ),
  );
});

test("timezone-aware ISO timestamps are accepted", () => {
  const employee = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    [
      {
        ...VALID_ROW,
        CREATED_AT: "2026-01-01T08:00:00+07:00",
        UPDATED_AT: "2026-01-01T09:00:00+07:00",
      },
    ],
  ).employees[0];

  assert.ok(employee.sourceCreatedAt instanceof Date);
  assert.ok(employee.sourceUpdatedAt instanceof Date);
});

test("timezone-less timestamps are rejected", () => {
  const error = expectAdapterError(() =>
    adaptPentahoEmployeeBatch(
      PENTAHO_EMPLOYEE_HEADERS,
      [
        {
          ...VALID_ROW,
          CREATED_AT: "2026-01-01T08:00:00",
        },
      ],
    ),
  );

  assert.ok(
    error.issues.some(
      (issue) =>
        issue.code === "INVALID_TIMESTAMP" &&
        issue.field === "CREATED_AT",
    ),
  );
});

test("invalid timestamps are rejected", () => {
  const error = expectAdapterError(() =>
    adaptPentahoEmployeeBatch(
      PENTAHO_EMPLOYEE_HEADERS,
      [
        {
          ...VALID_ROW,
          UPDATED_AT: "not-a-timestamp",
        },
      ],
    ),
  );

  assert.ok(
    error.issues.some(
      (issue) =>
        issue.code === "INVALID_TIMESTAMP" &&
        issue.field === "UPDATED_AT",
    ),
  );
});

test("empty source actors are rejected", () => {
  for (const field of ["CREATED_BY", "UPDATED_BY"] as const) {
    const error = expectAdapterError(() =>
      adaptPentahoEmployeeBatch(
        PENTAHO_EMPLOYEE_HEADERS,
        [
          {
            ...VALID_ROW,
            [field]: "   ",
          },
        ],
      ),
    );

    assert.ok(
      error.issues.some(
        (issue) =>
          issue.code === "REQUIRED_VALUE_EMPTY" &&
          issue.field === field,
      ),
    );
  }
});

test("UPDATED_AT earlier than CREATED_AT is rejected", () => {
  const error = expectAdapterError(() =>
    adaptPentahoEmployeeBatch(
      PENTAHO_EMPLOYEE_HEADERS,
      [
        {
          ...VALID_ROW,
          CREATED_AT: "2026-01-02T00:00:00.000Z",
          UPDATED_AT: "2026-01-01T00:00:00.000Z",
        },
      ],
    ),
  );

  assert.ok(
    error.issues.some(
      (issue) =>
        issue.code === "INVALID_TIMESTAMP_ORDER" &&
        issue.field === "UPDATED_AT",
    ),
  );
});

test("source metadata maps to source fields only", () => {
  const employee = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    [VALID_ROW],
  ).employees[0];

  assert.equal(employee.sourceCreatedBy, "pentaho-user");
  assert.equal(employee.sourceUpdatedBy, "pentaho-user-2");
  assert.equal(
    employee.sourceCreatedAt.toISOString(),
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(
    employee.sourceUpdatedAt.toISOString(),
    "2026-01-02T00:00:00.000Z",
  );
  assert.equal("createdAt" in employee, false);
  assert.equal("updatedAt" in employee, false);
});

test("Task 2A regional mapping is reused", () => {
  assert.equal(
    externalUnitCodeFromSource({
      kodeDolog: "01",
      kodeSubdolog: "01",
      kodeOrg: "D00C00",
    }),
    "WILAYAH:01:01",
  );
});

test("Task 2A central roots and aliases are preserved", () => {
  assert.equal(
    externalUnitCodeFromSource({
      kodeDolog: "00",
      kodeSubdolog: "00",
      kodeOrg: "D15000",
    }),
    "DIVISI:D15000",
  );

  assert.equal(
    externalUnitCodeFromSource({
      kodeDolog: "00",
      kodeSubdolog: "00",
      kodeOrg: "D49000",
    }),
    "DIVISI:D49000",
  );

  assert.equal(
    externalUnitCodeFromSource({
      kodeDolog: "00",
      kodeSubdolog: "00",
      kodeOrg: "E10000",
    }),
    "DIVISI:E10000",
  );
});

test("KODE_GUDANG remains provenance only", () => {
  const employee = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    [
      {
        ...VALID_ROW,
        KODE_GUDANG: "99",
      },
    ],
  ).employees[0];

  assert.equal(employee.sourceKodeGudang, "99");
  assert.equal(employee.externalUnitCode, "WILAYAH:01:01");
});

test("all required fields reject whitespace-only values", () => {
  const requiredFields = [
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
    "CREATED_AT",
    "CREATED_BY",
    "UPDATED_AT",
    "UPDATED_BY",
  ] as const;

  for (const field of requiredFields) {
    const error = expectAdapterError(() =>
      adaptPentahoEmployeeBatch(
        PENTAHO_EMPLOYEE_HEADERS,
        [
          {
            ...VALID_ROW,
            [field]: "   ",
          },
        ],
      ),
    );

    assert.ok(
      error.issues.some(
        (issue) =>
          issue.field === field &&
          (issue.code === "REQUIRED_VALUE_EMPTY" ||
            issue.code === "INVALID_TIMESTAMP"),
      ),
      `Expected validation issue for ${field}`,
    );
  }
});

test("duplicate NIP fails before reconciliation", () => {
  const error = expectAdapterError(() =>
    adaptPentahoEmployeeBatch(
      PENTAHO_EMPLOYEE_HEADERS,
      [
        VALID_ROW,
        {
          ...VALID_ROW,
          NAMA: "Employee Two",
        },
      ],
    ),
  );

  assert.ok(
    error.issues.some(
      (issue) => issue.code === "DUPLICATE_NIP",
    ),
  );
});

test("workbook regression normalizes all 4647 rows", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(fixturePath());

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("Pentaho fixture tidak memiliki worksheet");
  }

  const coreHeaders: string[] = [];

  worksheet
    .getRow(1)
    .eachCell({ includeEmpty: true }, (cell) => {
      coreHeaders.push(cell.text.trim().toUpperCase());
    });

  const rows: Array<Record<string, unknown>> = [];

  worksheet.eachRow(
    { includeEmpty: true },
    (row, rowNumber) => {
      if (rowNumber === 1) return;

      const mapped: Record<string, unknown> = {};

      coreHeaders.forEach((header, index) => {
        mapped[header] = row.getCell(index + 1).text;
      });

      mapped.CREATED_AT = "2026-01-01T00:00:00.000Z";
      mapped.CREATED_BY = "fixture";
      mapped.UPDATED_AT = "2026-01-02T00:00:00.000Z";
      mapped.UPDATED_BY = "fixture";
      rows.push(mapped);
    },
  );

  assert.equal(rows.length, 4_647);

  const snapshot = adaptPentahoEmployeeBatch(
    PENTAHO_EMPLOYEE_HEADERS,
    rows,
  );

  assert.equal(snapshot.employees.length, 4_647);
  assert.equal(
    new Set(snapshot.employees.map((employee) => employee.nip)).size,
    4_647,
  );

  assert.deepEqual(
    new Set(
      snapshot.employees.map(
        (employee) => employee.jenjangLabel,
      ),
    ),
    new Set([
      "0. Direktur Utama",
      "01. Wakil Dirut",
      "02. Direksi",
      "1. Jenjang Utama",
      "2. Jenjang I",
      "3. Jenjang II",
      "4. Jenjang III",
      "5. Jenjang IV",
      "6. Jenjang V",
      "7. Non Jenjang",
    ]),
  );
});
