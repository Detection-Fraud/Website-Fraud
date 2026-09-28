import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_MIRROR_ROWS,
  PentahoStageMirrorError,
  readPentahoEmployeeMirror,
  type PentahoStageMirrorRow,
} from "@/lib/pentaho-stage-mirror";
import { PENTAHO_EMPLOYEE_HEADERS } from "@/lib/pentaho-employee-adapter";

const isoCreated = "2026-09-21T10:00:00.000Z";
const isoUpdated = "2026-09-21T11:00:00.000Z";

function row(overrides: Partial<PentahoStageMirrorRow> = {}): PentahoStageMirrorRow {
  return {
    nip: "000123",
    nama: "Sari",
    jab_lkp: "Analis",
    kode_statpeg: "01",
    stat_kepeg: "02",
    kode_dolog: "01",
    kode_subdolog: "01",
    kode_kansilog: "01",
    kode_gudang: "G01",
    kode_org: "D00C00",
    jenjang: "4. Jenjang III",
    nama_org: "Organisasi",
    nama_satker: "Satuan Kerja",
    nama_induk: null,
    created_at: new Date(isoCreated),
    created_by: "Pentaho",
    updated_at: new Date(isoUpdated),
    updated_by: "Pentaho",
    ...overrides,
  };
}

test("maps all mirror columns, timestamps, and sanitized metadata", async () => {
  let receivedRows: readonly Record<string, unknown>[] = [];
  let receivedHeaders: readonly unknown[] = [];
  const snapshot = await readPentahoEmployeeMirror({
    readRows: async () => [row()],
    adapt: (headers, rows) => {
      receivedHeaders = headers;
      receivedRows = rows;
      return {
        sourceSystem: "PENTAHO",
        employees: [],
        sourceMetadata: { existing: "safe" },
      };
    },
  });

  assert.deepEqual(receivedHeaders, PENTAHO_EMPLOYEE_HEADERS);
  assert.deepEqual(receivedRows[0], {
    NIP: "000123",
    NAMA: "Sari",
    JAB_LKP: "Analis",
    KODE_STATPEG: "01",
    STAT_KEPEG: "02",
    KODE_DOLOG: "01",
    KODE_SUBDOLOG: "01",
    KODE_KANSILOG: "01",
    KODE_GUDANG: "G01",
    KODE_ORG: "D00C00",
    JENJANG: "4. Jenjang III",
    NAMA_ORG: "Organisasi",
    NAMA_SATKER: "Satuan Kerja",
    NAMA_INDUK: null,
    CREATED_AT: isoCreated,
    CREATED_BY: "Pentaho",
    UPDATED_AT: isoUpdated,
    UPDATED_BY: "Pentaho",
  });
  assert.deepEqual(snapshot.sourceMetadata, {
    orchestrationSource: "PENTAHO_STAGE_MIRROR",
    mirrorRowCount: 1,
  });
  assert.equal(Object.hasOwn(snapshot.sourceMetadata ?? {}, "rows"), false);
});

test("preserves deterministic database order for adapter input", async () => {
  let nips: string[] = [];
  await readPentahoEmployeeMirror({
    readRows: async () => [row({ nip: "2" }), row({ nip: "1" })],
    adapt: (_headers, rows) => {
      nips = rows.map((value) => String(value.NIP));
      return { sourceSystem: "PENTAHO", employees: [] };
    },
  });
  assert.deepEqual(nips, ["2", "1"]);
});

test("rejects an empty mirror", async () => {
  await assert.rejects(
    () => readPentahoEmployeeMirror({ readRows: async () => [], adapt: () => ({ sourceSystem: "PENTAHO", employees: [] }) }),
    (error: unknown) => error instanceof PentahoStageMirrorError && error.code === "EMPTY_MIRROR",
  );
});

test("accepts the maximum mirror size and rejects the bounded extra row", async () => {
  const rows = Array.from({ length: MAX_MIRROR_ROWS }, (_, index) => row({ nip: String(index + 1) }));
  let count = 0;
  await readPentahoEmployeeMirror({
    readRows: async () => rows,
    adapt: (_headers, values) => {
      count = values.length;
      return { sourceSystem: "PENTAHO", employees: [] };
    },
  });
  assert.equal(count, MAX_MIRROR_ROWS);

  await assert.rejects(
    () => readPentahoEmployeeMirror({
      readRows: async () => [...rows, row({ nip: "overflow" })],
      adapt: () => ({ sourceSystem: "PENTAHO", employees: [] }),
    }),
    (error: unknown) => error instanceof PentahoStageMirrorError && error.code === "MIRROR_LIMIT_EXCEEDED",
  );
});

test("propagates adapter failure without exposing mirror rows", async () => {
  await assert.rejects(
    () => readPentahoEmployeeMirror({
      readRows: async () => [row({ nip: "secret-nip" })],
      adapt: () => { throw new Error("adapter rejected"); },
    }),
    /adapter rejected/,
  );
});

test("sanitizes database failures", async () => {
  await assert.rejects(
    () => readPentahoEmployeeMirror({
      readRows: async () => { throw new Error("password=secret host=internal"); },
      adapt: () => ({ sourceSystem: "PENTAHO", employees: [] }),
    }),
    (error: unknown) => error instanceof PentahoStageMirrorError &&
      error.code === "MIRROR_DATABASE_ERROR" &&
      error.message === "Gagal membaca mirror Employee Pentaho",
  );
});
