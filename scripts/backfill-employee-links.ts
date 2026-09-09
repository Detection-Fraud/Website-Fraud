import { PrismaClient } from "@generated/prisma";
import { fileURLToPath } from "node:url";
import path from "node:path";

const prisma = new PrismaClient();
const APPLY_FLAG = "--apply";
const CONFIRM_FLAG = "--confirm-backfill";

export type CandidateUser = {
  id: string;
  name: string;
  username: string | null;
  samlNameId: string | null;
  authProvider: string;
  employeeId: string | null;
  role: "ADMIN" | "PIC" | "VIEWER";
};

export type EmployeeCandidate = {
  id: string;
  nip: string;
  user?: { id: string; name: string } | null;
};

export type PlannedEmployeeLink = {
  userId: string;
  employeeId: string;
  nip: string;
};

export function findConflictingEmployeeCandidates(
  users: readonly CandidateUser[],
  employeesByNip: ReadonlyMap<string, EmployeeCandidate>,
): string[] {
  const conflicts: string[] = [];

  for (const user of users) {
    const nips = new Set(
      [normalizedNip(user.username), normalizedNip(user.samlNameId)].filter(
        (nip): nip is string => nip !== null,
      ),
    );
    const matchedEmployees = [...nips]
      .map((nip) => ({ nip, employee: employeesByNip.get(nip) }))
      .filter(
        (
          match,
        ): match is { nip: string; employee: EmployeeCandidate } =>
          match.employee !== undefined,
      );
    const distinctEmployeeIds = new Set(
      matchedEmployees.map(({ employee }) => employee.id),
    );

    if (distinctEmployeeIds.size > 1) {
      conflicts.push(
        `User ${user.id} has distinct username/samlNameId NIPs mapping to different Employees: ${matchedEmployees
          .map(({ nip, employee }) => `${nip} -> ${employee.id}`)
          .join(", ")}`,
      );
    }
  }

  return conflicts;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function normalizedNip(value: string | null) {
  const nip = value?.trim() ?? "";
  return nip.length > 0 ? nip : null;
}

export function planEmployeeLinks(
  users: readonly CandidateUser[],
  employeesByNip: ReadonlyMap<string, EmployeeCandidate>,
): { conflicts: string[]; links: PlannedEmployeeLink[] } {
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

  const conflicts = findConflictingEmployeeCandidates(
    users,
    employeesByNip,
  );
  const links: PlannedEmployeeLink[] = [];

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

  return { conflicts, links };
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

  const nips = [
    ...new Set(
      users.flatMap((user) =>
        [normalizedNip(user.username), normalizedNip(user.samlNameId)].filter(
          (nip): nip is string => nip !== null,
        ),
      ),
    ),
  ];
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
  const { conflicts, links } = planEmployeeLinks(
    users,
    employeesByNip,
  );

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

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
