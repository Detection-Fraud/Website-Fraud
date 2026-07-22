import { PrismaClient } from "@generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Memulai backfill createdById dari ActivityLog...");

  // 1. Ambil semua log submission yang punya actorId
  const logs = await prisma.activityLog.findMany({
    where: {
      action: "SUBMITTED",
      actorId: { not: null },
    },
    select: {
      reportId: true,
      actorId: true,
    },
  });

  console.log(`📋 Ditemukan ${logs.length} log submission.`);

  let updatedCount = 0;

  // 2. Update createdById pada ActivityReport
  for (const log of logs) {
    if (log.actorId) {
      await prisma.activityReport.update({
        where: { id: log.reportId },
        data: { createdById: log.actorId },
      });
      updatedCount++;
    }
  }

  console.log(`✅ Sukses mem-backfill ${updatedCount} data ActivityReport!`);
}

main()
  .catch((e) => {
    console.error("❌ Error saat backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
