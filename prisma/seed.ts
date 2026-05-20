import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Menghapus data lama...");
  // Hapus berurutan dari tabel "Anak" ke tabel "Bapak" agar tidak error Foreign Key
  await prisma.activityPhoto.deleteMany();
  await prisma.activityReport.deleteMany();
  await prisma.programBudaya.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.division.deleteMany();
  await prisma.region.deleteMany();

  console.log("🏗️ Membuat Master Data Wilayah...");

  // 1. Buat Region (Kanwil)
  const regionDKI = await prisma.region.create({
    data: { name: "DKI Jakarta", kode: "DKI01" },
  });

  // const regionJabar = await prisma.region.create({
  //   data: { name: "Jawa Barat", kode: "JBR01" },
  // });

  // 2. Buat Branch (Kancab)
  const branchJaksel = await prisma.branch.create({
    data: { name: "Kancab Jakarta Selatan", regionId: regionDKI.id },
  });

  // 3. Buat Division (Divisi Pusat)
  // const divIT = await prisma.division.create({
  //   data: { name: "Divisi Teknologi Informasi" },
  // });

  console.log("👤 Membuat Dummy Users...");
  const defaultPassword = await bcrypt.hash("password123", 10);

  // --- USER 1: ADMIN PUSAT ---
  // Tidak terikat wilayah manapun, bebas akses semua
  await prisma.user.create({
    data: {
      name: "Budi Admin",
      username: "admin.pusat",
      password: defaultPassword,
      role: "ADMIN",
    },
  });

  // --- USER 2: PIC KANWIL (DKI JAKARTA) ---
  // Bisa submit laporan khusus region DKI Jakarta
  await prisma.user.create({
    data: {
      name: "Siti Kanwil",
      username: "pic.dki",
      password: defaultPassword,
      role: "PIC",
      regionId: regionDKI.id,
    },
  });

  // --- USER 3: PIC KANCAB (JAKARTA SELATAN) ---
  // Bisa submit laporan khusus kancab Jaksel
  await prisma.user.create({
    data: {
      name: "Agus Kancab",
      username: "pic.jaksel",
      password: defaultPassword,
      role: "PIC",
      regionId: regionDKI.id, // Kancab ini ada di region DKI
      branchId: branchJaksel.id,
    },
  });

  // --- USER 4: VIEWER KANCAB (JAKARTA SELATAN) ---
  // Karyawan biasa, cuma bisa lihat-lihat laporan dan kalender
  await prisma.user.create({
    data: {
      name: "Rina Pegawai Biasa",
      username: "viewer.jaksel",
      password: defaultPassword,
      role: "VIEWER",
      regionId: regionDKI.id,
      branchId: branchJaksel.id,
    },
  });

  console.log("📂 Membuat Dummy Program Budaya...");
  const data1 = await prisma.programBudaya.create({
    data: {
      name: "Jumat Bersih & Sehat",
      frequency: 12, // Target: 12 kali laporan
      startDate: new Date("2026-01-01T00:00:00Z"), // Mulai 1 Januari 2026
      endDate: new Date("2026-12-31T23:59:59Z"), // Berakhir 31 Desember 2026
    },
  });

  const data2 = await prisma.programBudaya.create({
    data: {
      name: "Sharing Session Teknologi",
      frequency: 4, // Target: 4 kali laporan (misal 1x tiap Triwulan)
      startDate: new Date("2026-06-01T00:00:00Z"),
      endDate: new Date("2026-12-31T23:59:59Z"),
    },
  });

  console.log("📝 Membuat Dummy Activity Report...");
  await prisma.activityReport.create({
    data: {
      activityName: "Sosialisasi Anti Fraud",
      tanggalKegiatan: new Date("2026-05-01T09:00:00Z"),
      lokasi: "Kantor Cabang Jakarta Selatan",
      description:
        "Kegiatan rutin penyuluhan anti fraud kepada seluruh pegawai cabang.",
      picKegiatan: "Agus Kancab",
      status: "PENDING",
      regionId: regionDKI.id,
      branchId: branchJaksel.id,
      programId: data1.id,
    },
  });

  await prisma.activityReport.create({
    data: {
      activityName: "Sosialisasi Anti Fraud",
      tanggalKegiatan: new Date("2026-06-01T09:00:00Z"),
      lokasi: "Kantor Cabang Jakarta Selatan",
      description:
        "Kegiatan rutin penyuluhan anti fraud kepada seluruh pegawai cabang.",
      picKegiatan: "Agus Kancab",
      status: "PENDING",
      regionId: regionDKI.id,
      branchId: branchJaksel.id,
      programId: data2.id,
    },
  });

  console.log("✅ Seeding Selesai! Semua data berhasil dibuat.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
