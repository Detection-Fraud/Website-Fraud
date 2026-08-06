import { PrismaClient, UnitType } from "@generated/prisma";
import bcrypt from "bcryptjs";
import path from "path";
import * as XLSX from "xlsx";

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

// MAIN SEED FUNC

async function main() {
  console.log("🧹 Menghapus data lama...");
  await prisma.activityPhoto.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.activityReport.deleteMany();
  await prisma.programBudaya.deleteMany();
  await prisma.programCategory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();

  // BACA FILE EXCEL DATA KANWIL, KANCAB, DIVISI
  console.log("📊 Membaca File Excel...");
  const excelPath = path.resolve(
    process.cwd(),
    "data/unit/DATA DIVISI, KANWIL, KANCAB SELINDO PER 22 MEI 2026.xlsx",
  );

  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

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
    await prisma.unit.create({
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
    await prisma.unit.create({
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

    await prisma.unit.create({
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
  await prisma.user.create({
    data: {
      name: "Budi Admin",
      username: "admin.pusat",
      password: defaultPassword,
      role: "ADMIN",
    },
  });

  // PIC KANWIL (JAWA BARAT)
  if (kanwilJabar) {
    await prisma.user.create({
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
    picBandung = await prisma.user.create({
      data: {
        name: "Agus Kancab Bandung",
        username: "pic.bandung",
        password: defaultPassword,
        role: "PIC",
        unitId: kancabBandung.id,
      },
    });

    // VIEWER KANCAB BANDUNG
    await prisma.user.create({
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
    await prisma.user.create({
      data: {
        name: "Putri PIC Divisi IT",
        username: "pic.divisi",
        password: defaultPassword,
        role: "PIC",
        unitId: divisiIT.id,
      },
    });

    // VIEWER DIVISI IT
    await prisma.user.create({
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
