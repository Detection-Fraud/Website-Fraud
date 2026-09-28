import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@generated/prisma/client";
import {
  CANONICAL_LHOKSEUMAWE_ORG,
  PENTAHO_SOURCE_SYSTEM,
  buildMappingPlan,
  type MappingUnit,
} from "../src/lib/pentaho-unit-mapping";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const EXPECTED_MAPPING_COUNT = 200;
const TRANSACTION_TIMEOUT_MS = 300_000;

type UnitRow = MappingUnit & {
  name: string;
  parentId: string | null;
};

function participationKey(row: {
  categoryId: string;
  tw: number;
  year: number;
}): string {
  return `${row.categoryId}:${row.tw}:${row.year}`;
}

function mappingKey(row: {
  sourceSystem: string;
  externalUnitCode: string;
}): string {
  return `${row.sourceSystem}:${row.externalUnitCode}`;
}

async function ensureDivisi(
  tx: Prisma.TransactionClient,
  input: {
    kodeOrg: string;
    kodeDivisi: string;
    name: string;
  },
): Promise<string> {
  const matches = await tx.unit.findMany({
    where: {
      type: "DIVISI",
      kodeOrg: input.kodeOrg,
    },
    select: { id: true },
  });

  if (matches.length > 1) {
    throw new Error(
      `Multiple DIVISI Units exist for ${input.kodeOrg}: ${matches
        .map((row) => row.id)
        .join(", ")}`,
    );
  }

  if (matches.length === 1) {
    const updated = await tx.unit.update({
      where: { id: matches[0].id },
      data: {
        name: input.name,
        type: "DIVISI",
        kodeDolog: "00",
        kodeSubdolog: "00",
        kodeOrg: input.kodeOrg,
        kodeDivisi: input.kodeDivisi,
        parentId: null,
      },
      select: { id: true },
    });

    return updated.id;
  }

  const created = await tx.unit.create({
    data: {
      name: input.name,
      type: "DIVISI",
      kodeDolog: "00",
      kodeSubdolog: "00",
      kodeOrg: input.kodeOrg,
      kodeDivisi: input.kodeDivisi,
      parentId: null,
    },
    select: { id: true },
  });

  return created.id;
}

async function preflightLhokseumawe(tx: Prisma.TransactionClient): Promise<{
  canonicalId: string;
  duplicateIds: string[];
}> {
  const candidates = await tx.unit.findMany({
    where: {
      type: "KANTOR_CABANG",
      kodeDolog: "01",
      kodeSubdolog: "01",
    },
    select: {
      id: true,
      kodeOrg: true,
      name: true,
      kodeDolog: true,
      kodeSubdolog: true,
      kodeDivisi: true,
      parentId: true,
    },
  });

  const canonical = candidates.filter(
    (row) => row.kodeOrg.trim() === CANONICAL_LHOKSEUMAWE_ORG,
  );

  const legacy = candidates.filter(
    (row) => row.kodeOrg.trim() === "E00C00",
  );

  const unexpected = candidates.filter(
    (row) =>
      row.kodeOrg.trim() !== CANONICAL_LHOKSEUMAWE_ORG &&
      row.kodeOrg.trim() !== "E00C00",
  );

  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected 01/01 Lhokseumawe Unit codes: ${unexpected
        .map((row) => row.kodeOrg)
        .join(", ")}`,
    );
  }

  if (canonical.length === 0 && legacy.length === 1) {
    const legacyUnit = legacy[0];
    const restored = await tx.unit.create({
      data: {
        name: legacyUnit.name,
        type: "KANTOR_CABANG",
        kodeDolog: legacyUnit.kodeDolog,
        kodeSubdolog: legacyUnit.kodeSubdolog,
        kodeOrg: CANONICAL_LHOKSEUMAWE_ORG,
        kodeDivisi: legacyUnit.kodeDivisi,
        parentId: legacyUnit.parentId,
      },
      select: {
        id: true,
        kodeOrg: true,
        name: true,
        kodeDolog: true,
        kodeSubdolog: true,
        kodeDivisi: true,
        parentId: true,
      },
    });

    canonical.push(restored);
  }

  if (canonical.length !== 1) {
    throw new Error(
      `Expected exactly one canonical Lhokseumawe ${CANONICAL_LHOKSEUMAWE_ORG}, found ${canonical.length}`,
    );
  }

  const duplicateIds = candidates
    .filter((row) => row.id !== canonical[0].id)
    .map((row) => row.id);

  if (duplicateIds.length === 0) {
    return {
      canonicalId: canonical[0].id,
      duplicateIds: [],
    };
  }

  const children = await tx.unit.findMany({
    where: {
      parentId: { in: duplicateIds },
    },
    select: {
      id: true,
      parentId: true,
    },
  });

  if (children.some((child) => child.id === canonical[0].id)) {
    throw new Error(
      "Unsafe Lhokseumawe merge: canonical Unit is a child of duplicate Unit",
    );
  }

  const canonicalParticipation = await tx.participationData.findMany({
    where: { unitId: canonical[0].id },
    select: {
      categoryId: true,
      tw: true,
      year: true,
    },
  });

  const duplicateParticipation = await tx.participationData.findMany({
    where: {
      unitId: { in: duplicateIds },
    },
    select: {
      categoryId: true,
      tw: true,
      year: true,
    },
  });

  const occupiedParticipationKeys = new Set(
    canonicalParticipation.map(participationKey),
  );

  for (const row of duplicateParticipation) {
    const key = participationKey(row);

    if (occupiedParticipationKeys.has(key)) {
      throw new Error(
        `Participation conflict during Lhokseumawe merge: ${key}`,
      );
    }

    occupiedParticipationKeys.add(key);
  }

  const canonicalMappings = await tx.unitExternalMapping.findMany({
    where: { unitId: canonical[0].id },
    select: {
      sourceSystem: true,
      externalUnitCode: true,
    },
  });

  const duplicateMappings = await tx.unitExternalMapping.findMany({
    where: {
      unitId: { in: duplicateIds },
    },
    select: {
      sourceSystem: true,
      externalUnitCode: true,
    },
  });

  const occupiedMappingKeys = new Set(canonicalMappings.map(mappingKey));

  for (const row of duplicateMappings) {
    const key = mappingKey(row);

    if (occupiedMappingKeys.has(key)) {
      throw new Error(
        `UnitExternalMapping conflict during Lhokseumawe merge: ${key}`,
      );
    }

    occupiedMappingKeys.add(key);
  }

  return {
    canonicalId: canonical[0].id,
    duplicateIds,
  };
}

async function moveLhokseumaweReferences(
  tx: Prisma.TransactionClient,
  canonicalId: string,
  duplicateIds: string[],
): Promise<void> {
  if (duplicateIds.length === 0) return;

  await tx.unit.updateMany({
    where: {
      parentId: { in: duplicateIds },
    },
    data: { parentId: canonicalId },
  });

  await tx.user.updateMany({
    where: {
      unitId: { in: duplicateIds },
    },
    data: { unitId: canonicalId },
  });

  await tx.employee.updateMany({
    where: {
      unitId: { in: duplicateIds },
    },
    data: { unitId: canonicalId },
  });

  await tx.activityReport.updateMany({
    where: {
      unitId: { in: duplicateIds },
    },
    data: { unitId: canonicalId },
  });

  await tx.participationData.updateMany({
    where: {
      unitId: { in: duplicateIds },
    },
    data: { unitId: canonicalId },
  });

  await tx.unitExternalMapping.updateMany({
    where: {
      unitId: { in: duplicateIds },
    },
    data: { unitId: canonicalId },
  });

  const remaining = await tx.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Unit"
    WHERE id = ANY(${duplicateIds})
  `;

  if (
    remaining.length !== 1 ||
    remaining[0].count !== BigInt(duplicateIds.length)
  ) {
    throw new Error("Unexpected Lhokseumawe duplicate count before deletion");
  }

  for (const duplicateId of duplicateIds) {
    const remainingReferences = await Promise.all([
      tx.user.count({ where: { unitId: duplicateId } }),
      tx.employee.count({ where: { unitId: duplicateId } }),
      tx.activityReport.count({ where: { unitId: duplicateId } }),
      tx.participationData.count({ where: { unitId: duplicateId } }),
      tx.unitExternalMapping.count({ where: { unitId: duplicateId } }),
      tx.unit.count({ where: { parentId: duplicateId } }),
    ]);

    if (remainingReferences.some((count) => count > 0)) {
      throw new Error(
        `Cannot delete Lhokseumawe duplicate ${duplicateId}; references remain`,
      );
    }
  }

  for (const duplicateId of duplicateIds) {
    await tx.unit.delete({
      where: { id: duplicateId },
    });
  }
}

async function upsertMappings(
  tx: Prisma.TransactionClient,
  mappings: ReturnType<typeof buildMappingPlan>,
): Promise<void> {
  const existing = await tx.unitExternalMapping.findMany({
    where: {
      sourceSystem: PENTAHO_SOURCE_SYSTEM,
    },
    select: {
      externalUnitCode: true,
    },
  });

  const expectedKeys = new Set(
    mappings.map((mapping) => mapping.externalUnitCode),
  );

  const stale = existing.filter(
    (mapping) => !expectedKeys.has(mapping.externalUnitCode),
  );

  if (stale.length > 0) {
    throw new Error(
      `Unexpected stale PENTAHO mappings: ${stale
        .map((mapping) => mapping.externalUnitCode)
        .join(", ")}`,
    );
  }

  for (const mapping of mappings) {
    await tx.unitExternalMapping.upsert({
      where: {
        sourceSystem_externalUnitCode: {
          sourceSystem: mapping.sourceSystem,
          externalUnitCode: mapping.externalUnitCode,
        },
      },
      create: {
        sourceSystem: mapping.sourceSystem,
        externalUnitCode: mapping.externalUnitCode,
        unitId: mapping.targetUnitId,
      },
      update: {
        unitId: mapping.targetUnitId,
      },
    });
  }
}

async function postcheck(tx: Prisma.TransactionClient): Promise<void> {
  const units = await tx.unit.findMany({
    select: {
      id: true,
      type: true,
      kodeDolog: true,
      kodeSubdolog: true,
      kodeOrg: true,
      name: true,
      parentId: true,
    },
  });

  const typedUnits = units as UnitRow[];

  const divisi = typedUnits.filter((unit) => unit.type === "DIVISI");
  const kanwil = typedUnits.filter((unit) => unit.type === "KANTOR_WILAYAH");
  const kancab = typedUnits.filter((unit) => unit.type === "KANTOR_CABANG");

  if (divisi.length !== 38 || kanwil.length !== 26 || kancab.length !== 133) {
    throw new Error(
      `Unexpected final Unit counts: DIVISI=${divisi.length}, KANWIL=${kanwil.length}, KANCAB=${kancab.length}`,
    );
  }

  const lhok = kancab.filter(
    (unit) => unit.kodeDolog === "01" && unit.kodeSubdolog === "01",
  );

  if (
    lhok.length !== 1 ||
    lhok[0].kodeOrg !== CANONICAL_LHOKSEUMAWE_ORG
  ) {
    throw new Error("Lhokseumawe postcheck failed");
  }

  const mappings = await tx.unitExternalMapping.findMany({
    where: {
      sourceSystem: PENTAHO_SOURCE_SYSTEM,
    },
    select: {
      externalUnitCode: true,
      unitId: true,
    },
  });

  if (mappings.length !== EXPECTED_MAPPING_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_MAPPING_COUNT} PENTAHO mappings, found ${mappings.length}`,
    );
  }

  const planned = buildMappingPlan(typedUnits);
  const actual = new Map(
    mappings.map((mapping) => [mapping.externalUnitCode, mapping.unitId]),
  );

  for (const mapping of planned) {
    if (actual.get(mapping.externalUnitCode) !== mapping.targetUnitId) {
      throw new Error(
        `Incorrect mapping target for ${mapping.externalUnitCode}`,
      );
    }
  }
}

export async function reconcilePentahoUnits(
  client: PrismaClient = prisma,
): Promise<void> {
  await client.$transaction(
    async (tx) => {
      const lhokseumawe = await preflightLhokseumawe(tx);

      await ensureDivisi(tx, {
        kodeOrg: "D15000",
        kodeDivisi: "D15",
        name: "PMO Mitra Tani",
      });

      await ensureDivisi(tx, {
        kodeOrg: "D49000",
        kodeDivisi: "D49",
        name: "PMO Transformasi",
      });

      await moveLhokseumaweReferences(
        tx,
        lhokseumawe.canonicalId,
        lhokseumawe.duplicateIds,
      );

      const units = (await tx.unit.findMany({
        select: {
          id: true,
          type: true,
          kodeDolog: true,
          kodeSubdolog: true,
          kodeOrg: true,
          name: true,
          parentId: true,
        },
      })) as UnitRow[];

      const mappings = buildMappingPlan(units);

      if (mappings.length !== EXPECTED_MAPPING_COUNT) {
        throw new Error(
          `Expected ${EXPECTED_MAPPING_COUNT} planned mappings, found ${mappings.length}`,
        );
      }

      await upsertMappings(tx, mappings);
      await postcheck(tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: TRANSACTION_TIMEOUT_MS,
    },
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  reconcilePentahoUnits()
    .then(async () => {
      console.log("Pentaho Unit reconciliation completed successfully.");
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await prisma.$disconnect();
      process.exitCode = 1;
    });
}
