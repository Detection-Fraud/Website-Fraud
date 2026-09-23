import { Prisma } from "@generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  adaptPentahoEmployeeBatch,
  PENTAHO_EMPLOYEE_HEADERS,
  type PentahoRawRow,
} from "@/lib/pentaho-employee-adapter";
import type { NormalizedEmployeeSnapshot } from "@/lib/employee-sync-contract";

export const MAX_MIRROR_ROWS = 100_000;
export const MIRROR_QUERY_LIMIT = MAX_MIRROR_ROWS + 1;

export type PentahoStageMirrorRow = {
  nip: string | null;
  nama: string | null;
  jab_lkp: string | null;
  kode_statpeg: string | null;
  stat_kepeg: string | null;
  kode_dolog: string | null;
  kode_subdolog: string | null;
  kode_kansilog: string | null;
  kode_gudang: string | null;
  kode_org: string | null;
  jenjang: string | null;
  nama_org: string | null;
  nama_satker: string | null;
  nama_induk: string | null;
  created_at: Date | string | null;
  created_by: string | null;
  updated_at: Date | string | null;
  updated_by: string | null;
};

export type PentahoStageMirrorErrorCode =
  | "EMPTY_MIRROR"
  | "MIRROR_LIMIT_EXCEEDED"
  | "MIRROR_DATABASE_ERROR";

export class PentahoStageMirrorError extends Error {
  readonly code: PentahoStageMirrorErrorCode;

  constructor(code: PentahoStageMirrorErrorCode, message: string) {
    super(message);
    this.name = "PentahoStageMirrorError";
    this.code = code;
  }
}

type PentahoStageMirrorDependencies = {
  readRows: () => Promise<readonly PentahoStageMirrorRow[]>;
  adapt: typeof adaptPentahoEmployeeBatch;
};

async function readMirrorRows(): Promise<readonly PentahoStageMirrorRow[]> {
  try {
    return await prisma.$queryRaw<PentahoStageMirrorRow[]>(Prisma.sql`
      SELECT
        "nip",
        "nama",
        "jab_lkp",
        "kode_statpeg",
        "stat_kepeg",
        "kode_dolog",
        "kode_subdolog",
        "kode_kansilog",
        "kode_gudang",
        "kode_org",
        "jenjang",
        "nama_org",
        "nama_satker",
        "nama_induk",
        "created_at",
        "created_by",
        "updated_at",
        "updated_by"
      FROM "pentaho_stage"."employee_mirror"
      ORDER BY "nip" ASC
      LIMIT ${MIRROR_QUERY_LIMIT}
    `);
  } catch {
    throw new PentahoStageMirrorError(
      "MIRROR_DATABASE_ERROR",
      "Gagal membaca mirror Employee Pentaho",
    );
  }
}

const defaultDependencies: PentahoStageMirrorDependencies = {
  readRows: readMirrorRows,
  adapt: adaptPentahoEmployeeBatch,
};

function timestampToIso(value: Date | string | null): string | null {
  if (value === null) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function mapMirrorRow(row: PentahoStageMirrorRow): PentahoRawRow {
  return {
    NIP: row.nip,
    NAMA: row.nama,
    JAB_LKP: row.jab_lkp,
    KODE_STATPEG: row.kode_statpeg,
    STAT_KEPEG: row.stat_kepeg,
    KODE_DOLOG: row.kode_dolog,
    KODE_SUBDOLOG: row.kode_subdolog,
    KODE_KANSILOG: row.kode_kansilog,
    KODE_GUDANG: row.kode_gudang,
    KODE_ORG: row.kode_org,
    JENJANG: row.jenjang,
    NAMA_ORG: row.nama_org,
    NAMA_SATKER: row.nama_satker,
    NAMA_INDUK: row.nama_induk,
    CREATED_AT: timestampToIso(row.created_at),
    CREATED_BY: row.created_by,
    UPDATED_AT: timestampToIso(row.updated_at),
    UPDATED_BY: row.updated_by,
  };
}

export async function readPentahoEmployeeMirror(
  dependencies: PentahoStageMirrorDependencies = defaultDependencies,
): Promise<NormalizedEmployeeSnapshot> {
  let rows: readonly PentahoStageMirrorRow[];
  try {
    rows = await dependencies.readRows();
  } catch (error) {
    if (error instanceof PentahoStageMirrorError) throw error;
    throw new PentahoStageMirrorError(
      "MIRROR_DATABASE_ERROR",
      "Gagal membaca mirror Employee Pentaho",
    );
  }

  if (rows.length === 0) {
    throw new PentahoStageMirrorError(
      "EMPTY_MIRROR",
      "Mirror Employee Pentaho kosong",
    );
  }

  if (rows.length > MAX_MIRROR_ROWS) {
    throw new PentahoStageMirrorError(
      "MIRROR_LIMIT_EXCEEDED",
      "Mirror Employee Pentaho melebihi batas 100000 row",
    );
  }

  const snapshot = dependencies.adapt(
    PENTAHO_EMPLOYEE_HEADERS,
    rows.map(mapMirrorRow),
  );

  return {
    ...snapshot,
    sourceMetadata: {
      orchestrationSource: "PENTAHO_STAGE_MIRROR",
      mirrorRowCount: rows.length,
    },
  };
}
