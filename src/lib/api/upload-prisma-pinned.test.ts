import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";
import { Client } from "pg";
import {
  acquireUploadLifecycleLocks,
  encodeUploadAdvisoryKey,
} from "./upload-lifecycle";

const connectionString = process.env.UPLOAD_STORAGE_TEST_DATABASE_URL?.trim();
const unitId = "11111111-1111-4111-8111-111111111111";
const fileKey =
  `reports/${unitId}/2026/09/33333333-3333-4333-8333-333333333333.jpg`;

test(
  "PrismaPg interactive transaction keeps upload lock on the pinned connection",
  { skip: connectionString ? false : "UPLOAD_STORAGE_TEST_DATABASE_URL is not set" },
  async () => {
    assert(connectionString);

    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    const observer = new Client({ connectionString });
    let releaseCallback: (() => void) | undefined;
    let signalCallbackReached: (() => void) | undefined;

    try {
      await observer.connect();

      const callbackReached = new Promise<void>((resolve) => {
        signalCallbackReached = resolve;
      });
      const callbackMayFinish = new Promise<void>((resolve) => {
        releaseCallback = () => resolve();
      });

      const transaction = prisma.$transaction(async (tx) => {
        await acquireUploadLifecycleLocks(tx, {
          entities: [],
          fileKeys: [fileKey],
        });
        signalCallbackReached?.();
        await callbackMayFinish;
      });

      await callbackReached;

      const advisoryKey = encodeUploadAdvisoryKey("file", `file:${fileKey}`);
      const whileHeld = await observer.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_xact_lock($1::bigint) AS locked",
        [advisoryKey.toString()],
      );
      assert.equal(whileHeld.rows[0]?.locked, false);

      releaseCallback?.();
      await transaction;

      const afterCommit = await observer.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_xact_lock($1::bigint) AS locked",
        [advisoryKey.toString()],
      );
      assert.equal(afterCommit.rows[0]?.locked, true);
    } finally {
      releaseCallback?.();
      await observer.end().catch(() => undefined);
      await prisma.$disconnect();
    }
  },
);
