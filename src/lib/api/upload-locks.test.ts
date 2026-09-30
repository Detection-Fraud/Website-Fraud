import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@generated/prisma/client";
import {
  acquireUploadLifecycleLocks,
  captureActivityPhotoOwner,
  capturePersistedOldCleanup,
  captureProgramBudayaOwner,
  encodeUploadAdvisoryKey,
  normalizeUploadLockPlan,
  readPersistedOldCleanup,
  UploadLifecycleError,
} from "./upload-lifecycle";

const unitId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";
const fileKey = `reports/${unitId}/2026/09/33333333-3333-4333-8333-333333333333.jpg`;

function tx() {
  return {
    calls: [] as unknown[],
    async $executeRaw(query: unknown) {
      this.calls.push(query);
      return 1;
    },
    activityPhoto: {
      async findMany() {
        return [];
      },
      async findUnique() {
        return {
          id: 7,
          reportId,
          imageUrl: `/uploads/${fileKey}`,
          publicId: fileKey,
        };
      },
    },
    programCategory: {
      async findMany() {
        return [];
      },
      async findUnique() {
        return { id: unitId, bannerUrl: `/uploads/${fileKey}` };
      },
    },
    programBudaya: {
      async findMany() {
        return [];
      },
      async findUnique() {
        return { id: unitId, bannerUrl: `/uploads/${fileKey}` };
      },
    },
    loginBanner: {
      async findMany() {
        return [];
      },
      async findUnique() {
        return { id: unitId, imageUrl: `/uploads/${fileKey}` };
      },
    },
    picImportantInformation: {
      async findMany() {
        return [];
      },
      async findUnique() {
        return { id: unitId, imageUrl: `/uploads/${fileKey}` };
      },
    },
  };
}

function asTransaction(value: ReturnType<typeof tx>): Prisma.TransactionClient {
  return value as unknown as Prisma.TransactionClient;
}

test("normalizes and orders entities before file keys", () => {
  const plan = normalizeUploadLockPlan({
    entities: [
      { model: "ProgramBudaya", id: "b" },
      { model: "ActivityPhoto", id: "a" },
      { model: "ActivityPhoto", id: "a" },
    ],
    fileKeys: [fileKey, fileKey],
  });
  assert.deepEqual(plan.entities, [
    { model: "ActivityPhoto", id: "a" },
    { model: "ProgramBudaya", id: "b" },
  ]);
  assert.deepEqual(plan.fileKeys, [fileKey]);
});

test("advisory encoder is deterministic and namespace-separated", () => {
  assert.equal(
    encodeUploadAdvisoryKey("file", fileKey),
    encodeUploadAdvisoryKey("file", fileKey),
  );
  assert.notEqual(
    encodeUploadAdvisoryKey("entity", fileKey),
    encodeUploadAdvisoryKey("file", fileKey),
  );
});

test("advisory keys always fit a positive PostgreSQL bigint", () => {
  const max = BigInt("9223372036854775807");
  for (const namespace of ["entity", "file"] as const) {
    for (let index = 0; index < 1000; index += 1) {
      const key = encodeUploadAdvisoryKey(namespace, `lock-key-${index}`);
      assert.ok(key > BigInt(0) && key <= max);
    }
  }
});

test("locks use one supplied transaction in entity-then-file order", async () => {
  const database = tx();
  const lifecycle = await acquireUploadLifecycleLocks(asTransaction(database), {
    entities: [{ model: "ActivityPhoto", id: "7" }],
    fileKeys: [fileKey],
  });
  assert.equal(typeof lifecycle, "object");
  assert.equal(database.calls.length, 2);
  const firstQuery = database.calls[0] as { strings?: unknown };
  assert.ok(Array.isArray(firstQuery.strings));
  assert.ok(
    firstQuery.strings.some(
      (part) =>
        typeof part === "string" && part.includes("pg_advisory_xact_lock"),
    ),
  );
});



test("multiple entity and file locks are ordered regardless of input order", async () => {
  const secondFileKey =
    "banners/programs/44444444-4444-4444-8444-444444444444.jpg";
  const expected = [
    encodeUploadAdvisoryKey("entity", "entity:ActivityPhoto:9"),
    encodeUploadAdvisoryKey("entity", "entity:ProgramBudaya:z"),
    encodeUploadAdvisoryKey("file", `file:${secondFileKey}`),
    encodeUploadAdvisoryKey("file", `file:${fileKey}`),
  ];

  const firstDatabase = tx();
  await acquireUploadLifecycleLocks(asTransaction(firstDatabase), {
    entities: [
      { model: "ProgramBudaya", id: "z" },
      { model: "ActivityPhoto", id: "9" },
    ],
    fileKeys: [fileKey, secondFileKey],
  });

  const secondDatabase = tx();
  await acquireUploadLifecycleLocks(asTransaction(secondDatabase), {
    entities: [
      { model: "ActivityPhoto", id: "9" },
      { model: "ProgramBudaya", id: "z" },
    ],
    fileKeys: [secondFileKey, fileKey],
  });

  const firstSequence = firstDatabase.calls.map(
    (query) => (query as { values: unknown[] }).values[0],
  );
  const secondSequence = secondDatabase.calls.map(
    (query) => (query as { values: unknown[] }).values[0],
  );

  assert.deepEqual(firstSequence, expected);
  assert.deepEqual(secondSequence, expected);
  assert.deepEqual(firstSequence, secondSequence);
});

test("old cleanup provenance reads the locked DB row, not caller media values", async () => {
  const database = tx();
  database.programBudaya.findUnique = async () => ({
    id: unitId,
    bannerUrl: `/uploads/${fileKey}`,
  });
  const lifecycle = await acquireUploadLifecycleLocks(asTransaction(database), {
    entities: [{ model: "ProgramBudaya", id: unitId }],
    fileKeys: [fileKey],
  });

  // There is no caller-supplied URL/value in the locator API anymore.
  const owner = await captureProgramBudayaOwner(lifecycle, { id: unitId });
  assert.equal(
    readPersistedOldCleanup(capturePersistedOldCleanup(lifecycle, owner))
      .fileKey,
    fileKey,
  );

  const mismatched = tx();
  mismatched.programBudaya.findUnique = async () => ({
    id: unitId,
    bannerUrl: "/uploads/not-the-locked-file.jpg",
  });
  const mismatchedLifecycle = await acquireUploadLifecycleLocks(
    asTransaction(mismatched),
    { entities: [{ model: "ProgramBudaya", id: unitId }], fileKeys: [fileKey] },
  );
  await assert.rejects(
    () => captureProgramBudayaOwner(mismatchedLifecycle, { id: unitId }),
    UploadLifecycleError,
  );
});
