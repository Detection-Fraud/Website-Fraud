import { Prisma, UnitType, PrismaClient } from "@generated/prisma";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import path from "path";

const prisma = new PrismaClient();

interface ExcelRow {
  NAMA_ORG: string;
  KODE_DIV: string;
  NAMA_INDUK: string;
  KODE_DOLOG: string;
  KODE_SUBDOLOG: string;
  KODE_KANSILOG: string;
  KODE_GUDANG: string;
  KODE_ORG: string;
  STATUS_ORG: string | number;
}

function getUnitType(kodeDolog: string, kodeSubdolog: string): UnitType {
  const dolog = kodeDolog.trim();
  const subdolog = kodeSubdolog.trim();
  if (dolog === "00" && subdolog === "00") return "DIVISI";
  if (dolog !== "00" && subdolog === "00") return "KANTOR_WILAYAH";
  return "KANTOR_CABANG";
}

type SeedUnitData = {
  name: string;
  type: UnitType;
  kodeDolog: string;
  kodeSubdolog: string;
  kodeOrg: string;
  kodeDivisi: string | null;
  parentId?: string | null;
};

async function upsertUnit({ data }: { data: SeedUnitData }) {
  const existing = await prisma.unit.findFirst({
    where: {
      type: data.type,
      kodeDolog: data.kodeDolog,
      kodeSubdolog: data.kodeSubdolog,
      kodeOrg: data.kodeOrg,
      parentId: data.parentId ?? null,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.unit.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.unit.create({ data });
}

async function ensureSeedUser({
  data,
}: {
  data: Prisma.UserUncheckedCreateInput;
}) {
  if (data.username) {
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
      select: { id: true },
    });

    if (existing) return existing;
  }

  return prisma.user.create({ data });
}

// MAIN SEED FUNC

async function main() {
  console.log(
    "Mempertahankan data existing; seed melakukan reconcile/upsert aman...",
  );

  // BACA FILE EXCEL DATA KANWIL, KANCAB, DIVISI
  console.log("📊 Membaca File Excel...");
  const excelPath = path.resolve(
    process.cwd(),
    "data/unit/DATA DIVISI, KANWIL, KANCAB SELINDO PER 22 MEI 2026.xlsx",
  );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const ws = workbook.worksheets[0];

  const headers: string[] = [];
  ws.getRow(1).eachCell((cell) => {
    headers.push(String(cell.value ?? "").trim());
  });

  const rows: ExcelRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowObj: any = {};
    row.eachCell((cell, colIndex) => {
      const header = headers[colIndex - 1];
      if (header) {
        rowObj[header] = String(cell.value ?? "").trim();
      }
    });
    if (Object.keys(rowObj).length > 0) rows.push(rowObj);
  });

  console.log(`Total baris dari Excel: ${rows.length}`);

  // KATEGORISASI UNIT BERDASARKAN KODE DOLOG & SUBDOLOG
  const divisiRows: ExcelRow[] = [];
  const kanwilRows: ExcelRow[] = [];
  const kancabRows: ExcelRow[] = [];

  for (const row of rows) {
    const type = getUnitType(row.KODE_DOLOG, row.KODE_SUBDOLOG);
    if (type === "DIVISI") divisiRows.push(row);
    else if (type === "KANTOR_WILAYAH") kanwilRows.push(row);
    else kancabRows.push(row);
  }

  console.log(`   → Divisi: ${divisiRows.length}`);
  console.log(`   → Kanwil: ${kanwilRows.length}`);
  console.log(`   → Kancab: ${kancabRows.length}`);

  // INSERT DIVISI (No Parent)

  console.log("🚀 Memulai Insert Divisi...");
  for (const row of divisiRows) {
    await upsertUnit({
      data: {
        name: row.NAMA_ORG.trim(),
        type: "DIVISI",
        kodeDolog: row.KODE_DOLOG.trim(),
        kodeSubdolog: row.KODE_SUBDOLOG.trim(),
        kodeOrg: row.KODE_ORG.trim(),
        kodeDivisi: row.KODE_DIV?.trim() || null,
      },
    });
  }

  // INSERT KANTOR WILAYAH (TANPA PARENT)

  console.log("Memuat data kanwil...");
  for (const row of kanwilRows) {
    await upsertUnit({
      data: {
        name: row.NAMA_ORG.trim(),
        type: "KANTOR_WILAYAH",
        kodeDolog: row.KODE_DOLOG.trim(),
        kodeSubdolog: row.KODE_SUBDOLOG.trim(),
        kodeOrg: row.KODE_ORG.trim(),
        kodeDivisi: row.KODE_DIV?.trim() || null,
      },
    });
  }

  // INSERT KANTOR CABANG (PARENT == KANWIL)
  console.log("Membuat data kancab...");
  const kanwilList = await prisma.unit.findMany({
    where: { type: "KANTOR_WILAYAH" },
    select: { id: true, kodeDolog: true, name: true },
  });

  const kanwilMap = new Map<string, string>();
  for (const k of kanwilList) {
    kanwilMap.set(k.kodeDolog, k.id);
  }

  let kancabLinked = 0;
  let kancabOrphan = 0;

  for (const row of kancabRows) {
    const parentKanwilId = kanwilMap.get(row.KODE_DOLOG.trim()) || null;

    if (parentKanwilId) {
      kancabLinked++;
    } else {
      kancabOrphan++;
      console.warn(
        `   ⚠️ Kancab "${row.NAMA_ORG}" (DOLOG: ${row.KODE_DOLOG}) tidak punya parent Kanwil`,
      );
    }

    await upsertUnit({
      data: {
        name: row.NAMA_ORG.trim(),
        type: "KANTOR_CABANG",
        kodeDolog: row.KODE_DOLOG.trim(),
        kodeSubdolog: row.KODE_SUBDOLOG.trim(),
        kodeOrg: row.KODE_ORG.trim(),
        kodeDivisi: row.KODE_DIV?.trim() || null,
        parentId: parentKanwilId,
      },
    });
  }

  console.log(`KANCAB TERHUBUNG KE KANWIL: ${kancabLinked}`);
  if (kancabOrphan > 0) {
    console.log(`KANCAB TIDAK TERHUBUNG KE KANWIL: ${kancabOrphan}`);
  }

  // VERIFIKASI DATA UNIT

  const unitCounts = await prisma.unit.groupBy({
    by: ["type"],
    _count: { id: true },
  });
  console.log("Verifikasi Unit");
  unitCounts.forEach((u) => console.log(`   → ${u.type}: ${u._count.id}`));

  // create dummy users

  console.log("Membuat Dummy users...");
  const defaultPassword = await bcrypt.hash("password123", 10);

  const kanwilJabar = await prisma.unit.findFirst({
    where: { type: "KANTOR_WILAYAH", name: { contains: "JABAR" } },
  });
  const kancabBandung = await prisma.unit.findFirst({
    where: { type: "KANTOR_CABANG", name: { contains: "BANDUNG" } },
  });
  const divisiIT = await prisma.unit.findFirst({
    where: { type: "DIVISI", name: { contains: "TEKNOLOGI INFORMASI" } },
  });

  // ADMIN PUSAT — tidak terikat unit manapun
  await ensureSeedUser({
    data: {
      name: "Budi Admin",
      username: "admin.pusat",
      password: defaultPassword,
      role: "ADMIN",
    },
  });

  // PIC KANWIL (JAWA BARAT)
  if (kanwilJabar) {
    await ensureSeedUser({
      data: {
        name: "Siti Kanwil Jabar",
        username: "pic.jabar",
        password: defaultPassword,
        role: "PIC",
        unitId: kanwilJabar.id,
      },
    });
  }

  // PIC KANCAB (BANDUNG)
  let picBandung: any = null;
  if (kancabBandung) {
    picBandung = await ensureSeedUser({
      data: {
        name: "Agus Kancab Bandung",
        username: "pic.bandung",
        password: defaultPassword,
        role: "PIC",
        unitId: kancabBandung.id,
      },
    });

    // VIEWER KANCAB BANDUNG
    await ensureSeedUser({
      data: {
        name: "Rina Viewer Bandung",
        username: "viewer.bandung",
        password: defaultPassword,
        role: "VIEWER",
        unitId: kancabBandung.id,
      },
    });
  }

  // PIC DIVISI IT
  if (divisiIT) {
    await ensureSeedUser({
      data: {
        name: "Putri PIC Divisi IT",
        username: "pic.divisi",
        password: defaultPassword,
        role: "PIC",
        unitId: divisiIT.id,
      },
    });

    // VIEWER DIVISI IT
    await ensureSeedUser({
      data: {
        name: "Budi Viewer Divisi IT",
        username: "viewer.divisi",
        password: defaultPassword,
        role: "VIEWER",
        unitId: divisiIT.id,
      },
    });
  }

  console.log("✅ Seeding Selesai! Data Unit & User berhasil dibuat.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
