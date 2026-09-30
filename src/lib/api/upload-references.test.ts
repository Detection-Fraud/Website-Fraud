import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@generated/prisma/client";
import {
  acquireUploadLifecycleLocks,
  findUploadReferences,
  UploadLifecycleError,
} from "./upload-lifecycle";

const unitId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";
const fileKey = `reports/${unitId}/2026/09/33333333-3333-4333-8333-333333333333.jpg`;

function database() {
  return {
    async $executeRaw() { return 1; },
    activityPhoto: { async findMany() { return [{ id: 7, reportId, imageUrl: `/uploads/${fileKey}`, publicId: fileKey }]; } },
    programCategory: { async findMany() { return [{ id: "44444444-4444-4444-8444-444444444444", bannerUrl: `/uploads/${fileKey}` }]; } },
    programBudaya: { async findMany() { return [{ id: "55555555-5555-4555-8555-555555555555", bannerUrl: `/uploads/${fileKey}` }]; } },
    loginBanner: { async findMany() { return [{ id: "66666666-6666-4666-8666-666666666666", imageUrl: `/uploads/${fileKey}` }]; } },
    picImportantInformation: { async findMany() { return [{ id: "77777777-7777-4777-8777-777777777777", imageUrl: `/uploads/${fileKey}` }]; } },
  };
}

function asTransaction(value: ReturnType<typeof database>): Prisma.TransactionClient {
  return value as unknown as Prisma.TransactionClient;
}

test("checks all six managed reference locations on the locked tx", async () => {
  const db = database();
  const lifecycle = await acquireUploadLifecycleLocks(asTransaction(db), {
    entities: [
      { model: "ActivityPhoto", id: "7" },
      { model: "ActivityReport", id: reportId },
    ],
    fileKeys: [fileKey],
  });
  const references = await findUploadReferences(lifecycle, fileKey);
  assert.deepEqual(references.map((item) => item.field).sort(), [
    "ActivityPhoto.imageUrl",
    "ActivityPhoto.publicId",
    "LoginBanner.imageUrl",
    "PicImportantInformation.imageUrl",
    "ProgramBudaya.bannerUrl",
    "ProgramCategory.bannerUrl",
  ]);
  assert.equal(
    references.find((item) => item.field === "LoginBanner.imageUrl")?.owner.kind,
    "LoginBanner",
  );
});

test("reference checker rejects unlocked keys and forged lifecycle", async () => {
  const db = database();
  const lifecycle = await acquireUploadLifecycleLocks(asTransaction(db), { entities: [], fileKeys: [] });
  await assert.rejects(() => findUploadReferences(lifecycle, fileKey), UploadLifecycleError);
  await assert.rejects(() => findUploadReferences({ __phase: "locked-lifecycle" }, fileKey), UploadLifecycleError);
});

test("reference checker uses the transaction captured by lifecycle", async () => {
  const db = database();
  const lifecycle = await acquireUploadLifecycleLocks(asTransaction(db), {
    entities: [
      { model: "ActivityPhoto", id: "7" },
      { model: "ActivityReport", id: reportId },
    ],
    fileKeys: [fileKey],
  });
  const other = database();
  other.activityPhoto.findMany = async () => [];
  const references = await findUploadReferences(lifecycle, fileKey);
  assert.equal(references.length, 6);
  assert.notEqual(other, db);
});
