import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  createServerOwnedUploadContext,
  getUtcYearMonthPartition,
  matchesExpectedUpdatedAt,
  mintCleanupToken,
  mintUploadDescriptor,
  parseExpectedUpdatedAt,
  readVerifiedNewUpload,
  UploadLifecycleError,
  verifyCleanupToken,
  verifyNewUpload,
  verifyUploadDescriptor,
  type ServerOwnedUploadContextInput,
} from "./upload-lifecycle";

const userId = "11111111-1111-4111-8111-111111111111";
const unitId = "22222222-2222-4222-8222-222222222222";
const reportId = "33333333-3333-4333-8333-333333333333";

const publicId = `reports/${unitId}/2026/09/44444444-4444-4444-8444-444444444444.jpg`;

const now = new Date("2026-09-21T00:00:00.000Z");

function context(extra: Partial<ServerOwnedUploadContextInput> = {}) {
  return createServerOwnedUploadContext({
    userId,
    purpose: "EVIDENCE",
    mode: "CREATE",
    publicId,
    unitId,
    ...extra,
  });
}

test("descriptor and cleanup token are separate HMAC artifacts", () => {
  process.env.AUTH_SECRET = "packet-b-secret";
  delete process.env.NEXTAUTH_SECRET;

  const descriptor = mintUploadDescriptor(context(), now);
  const cleanup = mintCleanupToken(context(), now);

  assert.notEqual(descriptor.descriptor, cleanup);
  assert.equal(descriptor.url, `/uploads/${publicId}`);

  const verified = verifyNewUpload(
    descriptor.descriptor,
    cleanup,
    context(),
    new Date("2026-09-21T00:00:01.000Z"),
  );

  assert.equal(readVerifiedNewUpload(verified).url, `/uploads/${publicId}`);

  assert.notEqual(verifyCleanupToken(cleanup, context(), now), undefined);
});

test("wrong context and tampering fail closed", () => {
  process.env.NEXTAUTH_SECRET = "packet-b-secret";
  delete process.env.AUTH_SECRET;

  const descriptor = mintUploadDescriptor(context(), now).descriptor;

  assert.throws(
    () =>
      verifyUploadDescriptor(descriptor, context({ userId: reportId }), now),
    UploadLifecycleError,
  );

  assert.throws(
    () =>
      verifyUploadDescriptor(descriptor, context({ unitId: reportId }), now),
    UploadLifecycleError,
  );

  assert.throws(
    () =>
      verifyUploadDescriptor(
        descriptor,
        createServerOwnedUploadContext({
          userId,
          purpose: "PROGRAM_BANNER",
          mode: "CREATE",
          publicId: "banners/programs/44444444-4444-4444-8444-444444444444.jpg",
        }),
        now,
      ),
    UploadLifecycleError,
  );

  const replacement = createServerOwnedUploadContext({
    userId,
    purpose: "EVIDENCE",
    mode: "REPLACEMENT",
    publicId,
    unitId,
    reportId,
  });

  assert.throws(
    () => verifyUploadDescriptor(descriptor, replacement, now),
    UploadLifecycleError,
  );

  assert.throws(
    () => verifyUploadDescriptor(`${descriptor}.tampered`, context(), now),
    UploadLifecycleError,
  );
});

test("descriptor and cleanup artifacts must be paired", () => {
  process.env.AUTH_SECRET = "packet-b-secret";

  const descriptor = mintUploadDescriptor(context(), now).descriptor;
  const cleanup = mintCleanupToken(context(), now);

  const descriptorOnly = verifyUploadDescriptor(descriptor, context(), now);

  const cleanupOnly = verifyCleanupToken(cleanup, context(), now);

  assert.throws(
    () => readVerifiedNewUpload(descriptorOnly as never),
    UploadLifecycleError,
  );

  assert.throws(
    () => readVerifiedNewUpload(cleanupOnly as never),
    UploadLifecycleError,
  );

  const differentInstantCleanup = mintCleanupToken(
    context(),
    new Date("2026-09-21T00:00:01.000Z"),
  );

  assert.doesNotThrow(() =>
    verifyNewUpload(
      descriptor,
      differentInstantCleanup,
      context(),
      new Date("2026-09-21T00:00:01.000Z"),
    ),
  );

  const differentContext = createServerOwnedUploadContext({
    userId,
    purpose: "EVIDENCE",
    mode: "CREATE",
    publicId: `reports/${unitId}/2026/09/55555555-5555-4555-8555-555555555555.jpg`,
    unitId,
  });

  const differentContextCleanup = mintCleanupToken(differentContext, now);

  assert.throws(
    () => verifyNewUpload(descriptor, differentContextCleanup, context(), now),
    UploadLifecycleError,
  );

  assert.equal(
    readVerifiedNewUpload(verifyNewUpload(descriptor, cleanup, context(), now))
      .url,
    `/uploads/${publicId}`,
  );
});

test("context grammar rejects invalid report/non-report combinations", () => {
  assert.throws(() => context({ reportId }), UploadLifecycleError);

  assert.throws(
    () =>
      createServerOwnedUploadContext({
        userId,
        purpose: "PROGRAM_BANNER",
        mode: "CREATE",
        publicId: "banners/programs/44444444-4444-4444-8444-444444444444.jpg",
        unitId,
      }),
    UploadLifecycleError,
  );

  assert.throws(
    () =>
      createServerOwnedUploadContext({
        userId,
        purpose: "EVIDENCE",
        mode: "REPLACEMENT",
        publicId,
        unitId,
      }),
    UploadLifecycleError,
  );
});

test("expiry is strict at exp and claims have a 24 hour TTL", () => {
  process.env.AUTH_SECRET = "packet-b-secret";

  const token = mintCleanupToken(context(), now);

  assert.throws(
    () =>
      verifyCleanupToken(
        token,
        context(),
        new Date("2026-09-22T00:00:00.000Z"),
      ),
    UploadLifecycleError,
  );

  assert.doesNotThrow(() =>
    verifyCleanupToken(token, context(), new Date("2026-09-21T23:59:59.000Z")),
  );
});

test("future iat and TTL greater than 24 hours fail closed", () => {
  process.env.AUTH_SECRET = "packet-b-secret";

  const makeSigned = (claims: Record<string, unknown>, domain: string) => {
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");

    const signature = createHmac("sha256", "packet-b-secret")
      .update(`${domain}\n${JSON.stringify(claims)}`)
      .digest("base64url");

    return `${payload}.${signature}`;
  };

  const futureIat = Math.floor(now.getTime() / 1000) + 1;

  const base = {
    v: 1,
    iss: "fraud-app/upload-lifecycle",
    sub: userId,
    purpose: "EVIDENCE",
    mode: "CREATE",
    publicId,
    unitId,
  };

  const futureDescriptor = makeSigned(
    {
      ...base,
      iat: futureIat,
      exp: futureIat + 86400,
      url: `/uploads/${publicId}`,
    },
    "upload-descriptor",
  );

  assert.throws(
    () => verifyUploadDescriptor(futureDescriptor, context(), now),
    UploadLifecycleError,
  );

  const currentIat = Math.floor(now.getTime() / 1000);

  const longCleanup = makeSigned(
    {
      ...base,
      iat: currentIat,
      exp: currentIat + 86401,
    },
    "upload-cleanup",
  );

  assert.throws(
    () => verifyCleanupToken(longCleanup, context(), now),
    UploadLifecycleError,
  );
});

test("missing secret fails closed", () => {
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;

  assert.throws(() => mintCleanupToken(context(), now), UploadLifecycleError);
});

test("forged VerifiedNewUpload handle is rejected", () => {
  process.env.AUTH_SECRET = "packet-b-secret";

  const artifact = mintUploadDescriptor(context(), now);

  const verified = verifyNewUpload(
    artifact.descriptor,
    mintCleanupToken(context(), now),
    context(),
    now,
  );

  assert.equal(readVerifiedNewUpload(verified).url, `/uploads/${publicId}`);

  assert.throws(
    () =>
      readVerifiedNewUpload({
        __phase: "verified-new-upload",
      }),
    UploadLifecycleError,
  );
});

test("expectedUpdatedAt is pure and strict", () => {
  const iso = "2026-09-21T00:00:00.000Z";

  assert.equal(parseExpectedUpdatedAt(iso).toISOString(), iso);

  assert.equal(matchesExpectedUpdatedAt(iso, new Date(iso)), true);

  assert.equal(
    matchesExpectedUpdatedAt(iso, new Date("2026-09-21T00:00:01.000Z")),
    false,
  );

  assert.throws(
    () => parseExpectedUpdatedAt("2026-09-21"),
    UploadLifecycleError,
  );
});

test("reuses Packet A UTC partition helper", () => {
  assert.deepEqual(
    getUtcYearMonthPartition(new Date("2026-12-31T23:59:59.999Z")),
    {
      year: "2026",
      month: "12",
    },
  );
});
