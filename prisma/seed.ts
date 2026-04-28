import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Memulai Proses Seeding data...");

  await prisma.activityReport.deleteMany();

  const haikalUser = await prisma.user.findUnique({
    where: {
      username: "haikal_admin",
    },
  });
  if (haikalUser && haikalUser.regionId) {
    // 3. Masukkan data dummy ke tabel ActivityReport
    await prisma.activityReport.createMany({
      data: [
        {
          regionId: haikalUser.regionId, // Pakai ID Kanwil milik Haikal
          branchId: haikalUser.branchId || undefined,
          divisionId: haikalUser.divisionId || undefined,
          activityName: "Penyaluran Beras SPHP",
          quarterPeriod: "Q1",
          year: "2026",
          claimedCount: 15,
          // createdAt otomatis diisi oleh Prisma (waktu saat ini)
        },
        {
          regionId: haikalUser.regionId,
          branchId: haikalUser.branchId || undefined,
          divisionId: haikalUser.divisionId || undefined,
          activityName: "Inspeksi Gudang Beras Jakarta",
          quarterPeriod: "Q1",
          year: "2026",
          claimedCount: 4,
        },
        {
          regionId: haikalUser.regionId,
          branchId: haikalUser.branchId || undefined,
          divisionId: haikalUser.divisionId || undefined,
          activityName: "Pengecekan Kualitas Gabah",
          quarterPeriod: "Q2",
          year: "2026",
          claimedCount: 8,
        },
      ],
    });
    console.log("✅ Berhasil membuat 3 data laporan!");
  } else {
    console.log(
      "⚠️ User haikal_admin tidak ditemukan atau tidak punya regionId.",
    );
  }
  // await prisma.user.deleteMany();
  // await prisma.branch.deleteMany();
  // await prisma.region.deleteMany();
  // await prisma.division.deleteMany();
  // await prisma.activityReport.deleteMany();
  // await prisma.activityPhoto.deleteMany();

  // const regionDKI = await prisma.region.create({
  //   data: {
  //     nama: "Kanwil DKI Jakarta",
  //     kode: "R-DKI-01",
  //   },
  // });

  // const branchJaksel = await prisma.branch.create({
  //   data: {
  //     name: "Kancab Jakarta Selatan",
  //     regionId: regionDKI.id,
  //   },
  // });

  // const divTI = await prisma.division.create({
  //   data: {
  //     name: "Divisi TI",
  //   },
  // });

  // const hashedPassword = await bcrypt.hash("password123", 10);

  // const adminUser = await prisma.user.create({
  //   data: {
  //     username: "haikal_admin",
  //     password: hashedPassword,
  //     name: "Haikal Abizar",
  //     role: "REGION",
  //     regionId: regionDKI.id,
  //     branchId: branchJaksel.id,
  //     divisionId: divTI.id,
  //     authProvider: "LOCAL",
  //   },
  // });

  console.log("Seed selesai, data berhasil dibuat!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
