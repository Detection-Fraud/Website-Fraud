import { PrismaClient } from "@generated/prisma";

const prisma = new PrismaClient();
const APPLY_FLAG = "--apply";
const CONFIRM_FLAG = "--confirm-backfill";

type CandidateUser = {
  id: string;
  name: string;
  username: string | null;
  samlNameId: string | null;
  authProvider: string;
  employeeId: string | null;
  role: "ADMIN" | "PIC" | "VIEWER";
};

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function normalizedNip(value: string | null) {
  const nip = value?.trim() ?? "";
  return nip.length > 0 ? nip : null;
}

async function main() {
  const apply = hasFlag(APPLY_FLAG);
  const confirmed = hasFlag(CONFIRM_FLAG);
  const dryRun = !apply;

  if (apply && !confirmed) {
    throw new Error(`Refusing to write without ${CONFIRM_FLAG}.`);
  }
  if (apply && process.env.NODE_ENV === "production") {
    throw new Error("Refusing backfill writes when NODE_ENV=production.");
  }

  const users = (await prisma.user.findMany({
    where: { authProvider: "SSO" },
    select: {
      id: true,
      name: true,
      username: true,
      samlNameId: true,
      authProvider: true,
      employeeId: true,
      role: true,
    },
  })) as CandidateUser[];

  const candidatesByNip = new Map<string, CandidateUser[]>();

  for (const user of users) {
    const nips = new Set(
      [normalizedNip(user.username), normalizedNip(user.samlNameId)].filter(
        (nip): nip is string => nip !== null,
      ),
    );

    for (const nip of nips) {
      const candidates = candidatesByNip.get(nip) ?? [];
      candidates.push(user);
      candidatesByNip.set(nip, candidates);
    }
  }

  const nips = [...candidatesByNip.keys()];
  const employees = await prisma.employee.findMany({
    where: { nip: { in: nips } },
    select: {
      id: true,
      nip: true,
      user: { select: { id: true, name: true } },
    },
  });

  const employeesByNip = new Map(
    employees.map((employee) => [employee.nip, employee]),
  );
  const conflicts: string[] = [];
  const links: Array<{ userId: string; employeeId: string; nip: string }> = [];

  for (const [nip, candidates] of candidatesByNip) {
    if (candidates.length > 1) {
      conflicts.push(
        `NIP ${nip} maps to multiple SSO Users: ${candidates.map((user) => user.id).join(", ")}`,
      );
      continue;
    }

    const user = candidates[0];
    const employee = employeesByNip.get(nip);

    if (!employee) {
      conflicts.push(`NIP ${nip} has no exact Employee match.`);
      continue;
    }

    if (user.employeeId && user.employeeId !== employee.id) {
      conflicts.push(
        `User ${user.id} is already linked to Employee ${user.employeeId}.`,
      );
      continue;
    }

    if (employee.user && employee.user.id !== user.id) {
      conflicts.push(
        `Employee ${employee.id} is already linked to User ${employee.user.id}.`,
      );
      continue;
    }

    if (!user.employeeId) {
      links.push({ userId: user.id, employeeId: employee.id, nip });
    }
  }

  const legacyParticipationCount = await prisma.participationData.count({
    where: { provenance: "LEGACY" },
  });

  console.log(`Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`Compatible links: ${links.length}`);
  console.log(
    `Legacy participation preserved/reported: ${legacyParticipationCount}`,
  );

  if (conflicts.length > 0) {
    console.error("Blocking conflicts:");
    for (const conflict of conflicts) {
      console.error(`- ${conflict}`);
    }
    process.exitCode = 1;
    return;
  }

  if (dryRun) return;

  await prisma.$transaction(async (tx) => {
    for (const link of links) {
      await tx.user.update({
        where: { id: link.userId },
        data: { employeeId: link.employeeId },
      });
    }
  });

  console.log(`Created ${links.length} User.employeeId links.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
