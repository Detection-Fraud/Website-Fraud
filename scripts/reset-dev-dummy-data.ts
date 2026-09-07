import { PrismaClient } from "@generated/prisma";

const prisma = new PrismaClient();
const CONFIRM_FLAG = "--confirm-reset-dev";

const DUMMY_USERNAMES = [
  "pic.jabar",
  "pic.bandung",
  "viewer.bandung",
  "pic.divisi",
  "viewer.divisi",
] as const;

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing development dummy reset when NODE_ENV=production.",
    );
  }

  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`Refusing reset without ${CONFIRM_FLAG}.`);
  }

  const fixtures = await prisma.user.findMany({
    where: { username: { in: [...DUMMY_USERNAMES] } },
    select: { id: true, username: true, role: true, isActive: true },
  });

  console.log(`Allowlisted fixtures found: ${fixtures.length}`);
  console.log(`Bootstrap/non-dummy Admin accounts are untouched.`);

  if (process.argv.includes("--dry-run")) return;

  const result = await prisma.user.updateMany({
    where: {
      username: { in: [...DUMMY_USERNAMES] },
      role: { not: "ADMIN" },
    },
    data: { isActive: false },
  });

  console.log(`Disabled ${result.count} allowlisted non-Admin fixtures.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
