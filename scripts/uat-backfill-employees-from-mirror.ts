import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma";
import { readPentahoEmployeeMirror } from "../src/lib/pentaho-stage-mirror";
import { syncEmployeeSnapshot } from "../src/lib/employee-sync";
import {
  assertUatMirrorTarget,
  expectedUatMirrorTarget,
  readUatMirrorTarget,
} from "./uat-mirror-guard";

const APPLY_FLAG = "--apply";
const CONFIRM_FLAG = "--confirm-uat-mirror-backfill";
const CONFIRMATION = "I_UNDERSTAND_UAT_MIRROR_BACKFILL";

async function main() {
  const expected = expectedUatMirrorTarget(process.env);
  const actual = await readUatMirrorTarget(process.env.DATABASE_URL ?? "");
  assertUatMirrorTarget(expected, actual);
  if (process.argv.includes("--target-only")) {
    console.log(`UAT target verified: ${actual.database} @ ${actual.host}; mirror: ${actual.mirrorCount}`);
    return;
  }

  const [employeeCount, mappingCount, activeRun] = await Promise.all([
    prisma.employee.count(),
    prisma.unitExternalMapping.count({ where: { sourceSystem: "PENTAHO" } }),
    prisma.employeeSyncRun.findFirst({
      where: { sourceSystem: "PENTAHO", status: { in: ["RUNNING", "SUCCEEDED"] } },
      select: { id: true },
    }),
  ]);
  if (employeeCount !== 0 || mappingCount !== 200 || activeRun) {
    throw new Error("UAT backfill requires an empty Employee table, 200 Pentaho mappings, and no active/successful sync run.");
  }

  const snapshot = await readPentahoEmployeeMirror();
  if (snapshot.employees.length !== expected.mirrorCount) {
    throw new Error("Mirror row count changed during UAT backfill preflight.");
  }

  console.log(`UAT target: ${actual.database} @ ${actual.host}; mirror: ${snapshot.employees.length}; mappings: ${mappingCount}`);
  if (!process.argv.includes(APPLY_FLAG)) {
    console.log("DRY RUN: Employee and EmployeeSyncRun were not changed.");
    return;
  }
  if (
    !process.argv.includes(CONFIRM_FLAG) ||
    process.env.UAT_BACKFILL_CONFIRMATION !== CONFIRMATION
  ) {
    throw new Error(`Refusing writes without ${CONFIRM_FLAG} and UAT_BACKFILL_CONFIRMATION=${CONFIRMATION}.`);
  }

  const result = await syncEmployeeSnapshot({
    ...snapshot,
    sourceMetadata: {
      ...snapshot.sourceMetadata,
      maintenanceBackfill: "UAT_MIRROR_DIRECT",
    },
  });
  console.log(`Employee backfill SUCCEEDED: run ${result.runId}; processed ${result.processedCount}; missing ${result.missingCount}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .catch((error: unknown) => {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
      const metaCode = error && typeof error === "object" && "meta" in error &&
        error.meta && typeof error.meta === "object" && "code" in error.meta
        ? String(error.meta.code)
        : "unknown";
      console.error("UAT mirror backfill failed:", error instanceof Error ? error.name : "unknown error", code, metaCode);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
