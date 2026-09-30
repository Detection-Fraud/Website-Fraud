import { createHmac, timingSafeEqual } from "node:crypto";

import {
  classifyManagedStorageKey,
  deleteManagedUploadFile,
  getUtcYearMonthPartition,
  storageKeyToPublicUrl,
} from "./upload-storage";

const TTL_SECONDS = 24 * 60 * 60;
const ISSUER = "fraud-app/upload-lifecycle";
const MAX_TOKEN_LENGTH = 4096;
const MAX_PUBLIC_ID_LENGTH = 256;
const MAX_URL_LENGTH = 512;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type UploadPurpose =
  | "EVIDENCE"
  | "PROGRAM_BANNER"
  | "CATEGORY_BANNER"
  | "LOGIN_BANNER";

export type UploadMode = "CREATE" | "REPLACEMENT";

export type ServerOwnedUploadContextInput = {
  userId: string;
  purpose: UploadPurpose;
  mode: UploadMode;
  publicId: string;
  unitId?: string;
  reportId?: string;
};

export type ServerOwnedUploadContext = Readonly<
  ServerOwnedUploadContextInput & { readonly __serverOwned: true }
>;

type ContextClaims = {
  sub: string;
  purpose: UploadPurpose;
  mode: UploadMode;
  publicId: string;
  unitId?: string;
  reportId?: string;
};

type Claims = ContextClaims & {
  v: 1;
  iss: string;
  iat: number;
  exp: number;
};

type DescriptorClaims = Claims & {
  url: string;
};

export type UploadDescriptorArtifact = {
  descriptor: string;
  publicId: string;
  url: string;
  iat: number;
  exp: number;
};

export type VerifiedDescriptor = {
  readonly __phase: "verified-descriptor";
};

export type VerifiedNewUpload = {
  readonly __phase: "verified-new-upload";
};

export type VerifiedCleanupCapability = {
  readonly __phase: "verified-cleanup-capability";
};

export type VerifiedUploadContext = ContextClaims & {
  iat: number;
  exp: number;
};

type VerifiedState = VerifiedUploadContext;

const verifiedNewUpload = new WeakMap<object, VerifiedState>();
const verifiedDescriptor = new WeakMap<object, VerifiedState>();
const verifiedCleanup = new WeakMap<object, VerifiedState>();
const serverOwnedContexts = new WeakSet<object>();

export class UploadLifecycleError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "UploadLifecycleError";
  }
}

function secret(): string {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!value) {
    throw new UploadLifecycleError("UPLOAD_LIFECYCLE_UNAVAILABLE");
  }

  return value;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(domain: string, payload: string): string {
  return base64Url(
    createHmac("sha256", secret()).update(`${domain}\n${payload}`).digest(),
  );
}

function constantTimeEqual(leftValue: string, rightValue: string): boolean {
  const left = Buffer.from(leftValue);
  const right = Buffer.from(rightValue);

  return left.length === right.length && timingSafeEqual(left, right);
}

function assertUuid(value: string, field: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new UploadLifecycleError(`INVALID_${field}`);
  }
}

function assertContext(input: ServerOwnedUploadContextInput): void {
  if (!input || typeof input.userId !== "string" || input.userId.length > 128) {
    throw new UploadLifecycleError("INVALID_USER");
  }

  assertUuid(input.userId, "USER");

  if (
    !["EVIDENCE", "PROGRAM_BANNER", "CATEGORY_BANNER", "LOGIN_BANNER"].includes(
      input.purpose,
    )
  ) {
    throw new UploadLifecycleError("INVALID_PURPOSE");
  }

  if (!["CREATE", "REPLACEMENT"].includes(input.mode)) {
    throw new UploadLifecycleError("INVALID_MODE");
  }

  if (
    !classifyManagedStorageKey(input.publicId) ||
    input.publicId.length > MAX_PUBLIC_ID_LENGTH
  ) {
    throw new UploadLifecycleError("INVALID_PUBLIC_ID");
  }

  const isReport = input.purpose === "EVIDENCE";

  if (isReport) {
    if (!input.unitId) {
      throw new UploadLifecycleError("UNIT_REQUIRED");
    }

    assertUuid(input.unitId, "UNIT");

    if (input.mode === "CREATE" && input.reportId !== undefined) {
      throw new UploadLifecycleError("REPORT_FORBIDDEN");
    }

    if (input.mode === "REPLACEMENT" && !input.reportId) {
      throw new UploadLifecycleError("REPORT_REQUIRED");
    }

    if (input.reportId) {
      assertUuid(input.reportId, "REPORT");
    }

    if (!input.publicId.startsWith(`reports/${input.unitId}/`)) {
      throw new UploadLifecycleError("UNIT_MISMATCH");
    }

    if (classifyManagedStorageKey(input.publicId) !== "report") {
      throw new UploadLifecycleError("PURPOSE_MISMATCH");
    }

    return;
  }

  if (input.unitId !== undefined || input.reportId !== undefined) {
    throw new UploadLifecycleError("REPORT_CONTEXT_FORBIDDEN");
  }

  const expectedPrefix = (
    {
      PROGRAM_BANNER: "banners/programs/",
      CATEGORY_BANNER: "banners/categories/",
      LOGIN_BANNER: "banners/login/",
    } as Record<Exclude<UploadPurpose, "EVIDENCE">, string>
  )[input.purpose as Exclude<UploadPurpose, "EVIDENCE">];

  if (!expectedPrefix || !input.publicId.startsWith(expectedPrefix)) {
    throw new UploadLifecycleError("PURPOSE_MISMATCH");
  }

  const expectedSource = (
    {
      PROGRAM_BANNER: "banner-programs",
      CATEGORY_BANNER: "banner-categories",
      LOGIN_BANNER: "banner-login",
    } as Record<Exclude<UploadPurpose, "EVIDENCE">, string>
  )[input.purpose as Exclude<UploadPurpose, "EVIDENCE">];

  if (classifyManagedStorageKey(input.publicId) !== expectedSource) {
    throw new UploadLifecycleError("PURPOSE_MISMATCH");
  }
}

/**
 * Server-only boundary.
 *
 * Call only after authentication/authorization, a successful managed write,
 * and backend-derived IDs. Shape validation is not authentication provenance.
 * Task 02 must derive these inputs server-side from session/DB state.
 */
export function createServerOwnedUploadContext(
  input: ServerOwnedUploadContextInput,
): ServerOwnedUploadContext {
  assertContext(input);

  const context = Object.freeze({
    ...input,
    __serverOwned: true as const,
  });

  serverOwnedContexts.add(context);

  return context;
}

function assertServerOwnedContext(context: ServerOwnedUploadContext): void {
  if (
    !context ||
    typeof context !== "object" ||
    !serverOwnedContexts.has(context)
  ) {
    throw new UploadLifecycleError("UNTRUSTED_CONTEXT");
  }
}

function claimsFromContext(
  context: ServerOwnedUploadContext,
  now: Date,
): Claims {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new UploadLifecycleError("INVALID_TIME");
  }

  const iat = Math.floor(now.getTime() / 1000);

  return {
    v: 1,
    iss: ISSUER,
    sub: context.userId,
    purpose: context.purpose,
    mode: context.mode,
    publicId: context.publicId,
    ...(context.unitId ? { unitId: context.unitId } : {}),
    ...(context.reportId ? { reportId: context.reportId } : {}),
    iat,
    exp: iat + TTL_SECONDS,
  };
}

function encode(domain: string, claims: object): string {
  const payload = JSON.stringify(claims);
  const token = `${base64Url(payload)}.${sign(domain, payload)}`;

  if (token.length > MAX_TOKEN_LENGTH) {
    throw new UploadLifecycleError("TOKEN_TOO_LARGE");
  }

  return token;
}

export function mintUploadDescriptor(
  context: ServerOwnedUploadContext,
  now = new Date(),
): UploadDescriptorArtifact {
  assertServerOwnedContext(context);
  assertContext(context);

  const claims = claimsFromContext(context, now);
  const url = storageKeyToPublicUrl(context.publicId);
  const descriptor = encode("upload-descriptor", {
    ...claims,
    url,
  });

  return {
    descriptor,
    publicId: context.publicId,
    url,
    iat: claims.iat,
    exp: claims.exp,
  };
}

export function mintCleanupToken(
  context: ServerOwnedUploadContext,
  now = new Date(),
): string {
  assertServerOwnedContext(context);
  assertContext(context);

  return encode("upload-cleanup", claimsFromContext(context, now));
}

function parse<T extends Claims>(token: string, domain: string): T {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    throw new UploadLifecycleError("INVALID_TOKEN");
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    throw new UploadLifecycleError("INVALID_TOKEN");
  }

  let payload: string;

  try {
    payload = decodeBase64Url(parts[0]);
  } catch {
    throw new UploadLifecycleError("INVALID_TOKEN");
  }

  if (!constantTimeEqual(sign(domain, payload), parts[1])) {
    throw new UploadLifecycleError("INVALID_TOKEN");
  }

  let value: unknown;

  try {
    value = JSON.parse(payload);
  } catch {
    throw new UploadLifecycleError("INVALID_TOKEN");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UploadLifecycleError("INVALID_TOKEN");
  }

  return value as T;
}

function verifyClaims(
  claims: Claims,
  context: ServerOwnedUploadContext,
  now: Date,
  descriptor = false,
): VerifiedState {
  const expected = claimsFromContext(context, now);

  const allowed = new Set([
    "v",
    "iss",
    "sub",
    "purpose",
    "mode",
    "publicId",
    "unitId",
    "reportId",
    "iat",
    "exp",
    ...(descriptor ? ["url"] : []),
  ]);

  for (const key of Object.keys(claims)) {
    if (!allowed.has(key)) {
      throw new UploadLifecycleError("INVALID_CLAIMS");
    }
  }

  for (const key of [
    "v",
    "iss",
    "sub",
    "purpose",
    "mode",
    "publicId",
    "iat",
    "exp",
  ] as const) {
    if (!(key in claims)) {
      throw new UploadLifecycleError("INVALID_CLAIMS");
    }
  }

  if (
    claims.v !== 1 ||
    claims.iss !== ISSUER ||
    !Number.isSafeInteger(claims.iat) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.iat >= claims.exp
  ) {
    throw new UploadLifecycleError("INVALID_CLAIMS");
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (
    claims.exp - claims.iat !== TTL_SECONDS ||
    claims.iat > nowSeconds ||
    claims.exp <= nowSeconds
  ) {
    throw new UploadLifecycleError("EXPIRED_TOKEN");
  }

  assertContext({
    userId: claims.sub,
    purpose: claims.purpose,
    mode: claims.mode,
    publicId: claims.publicId,
    unitId: claims.unitId,
    reportId: claims.reportId,
  });

  const expectedKeys = [
    "sub",
    "purpose",
    "mode",
    "publicId",
    "unitId",
    "reportId",
  ] as const;

  for (const key of expectedKeys) {
    if ((claims[key] ?? undefined) !== (expected[key] ?? undefined)) {
      throw new UploadLifecycleError("CONTEXT_MISMATCH");
    }
  }

  return {
    sub: claims.sub,
    purpose: claims.purpose,
    mode: claims.mode,
    publicId: claims.publicId,
    ...(claims.unitId ? { unitId: claims.unitId } : {}),
    ...(claims.reportId ? { reportId: claims.reportId } : {}),
    iat: claims.iat,
    exp: claims.exp,
  };
}

export function verifyUploadDescriptor(
  token: string,
  context: ServerOwnedUploadContext,
  now = new Date(),
): VerifiedDescriptor {
  assertServerOwnedContext(context);

  const claims = parse<DescriptorClaims>(token, "upload-descriptor");

  if (typeof claims.url !== "string" || claims.url.length > MAX_URL_LENGTH) {
    throw new UploadLifecycleError("INVALID_CLAIMS");
  }

  if (claims.url !== storageKeyToPublicUrl(claims.publicId)) {
    throw new UploadLifecycleError("INVALID_CLAIMS");
  }

  const state = verifyClaims(claims, context, now, true);
  const handle = Object.freeze({
    __phase: "verified-descriptor" as const,
  });

  verifiedDescriptor.set(handle, state);

  return handle;
}

export function verifyCleanupToken(
  token: string,
  context: ServerOwnedUploadContext,
  now = new Date(),
): VerifiedCleanupCapability {
  assertServerOwnedContext(context);

  const state = verifyClaims(
    parse<Claims>(token, "upload-cleanup"),
    context,
    now,
  );

  const handle = Object.freeze({
    __phase: "verified-cleanup-capability" as const,
  });

  verifiedCleanup.set(handle, state);

  return handle;
}

export function verifyNewUpload(
  descriptorToken: string,
  cleanupToken: string,
  context: ServerOwnedUploadContext,
  now = new Date(),
): VerifiedNewUpload {
  const descriptor = verifyUploadDescriptor(descriptorToken, context, now);

  const cleanup = verifyCleanupToken(cleanupToken, context, now);
  const descriptorState = verifiedDescriptor.get(descriptor as object);
  const cleanupState = verifiedCleanup.get(cleanup as object);

  if (!descriptorState || !cleanupState) {
    throw new UploadLifecycleError("UNVERIFIED_UPLOAD_PAIR");
  }

  const keys: (keyof VerifiedState)[] = [
    "sub",
    "purpose",
    "mode",
    "publicId",
    "unitId",
    "reportId",
  ];

  for (const key of keys) {
    if (descriptorState[key] !== cleanupState[key]) {
      throw new UploadLifecycleError("ARTIFACT_MISMATCH");
    }
  }

  const handle = Object.freeze({
    __phase: "verified-new-upload" as const,
  });

  verifiedNewUpload.set(handle, descriptorState);

  return handle;
}

export function readVerifiedNewUpload(
  handle: VerifiedNewUpload,
): VerifiedState & { url: string } {
  const state = verifiedNewUpload.get(handle as object);

  if (!state) {
    throw new UploadLifecycleError("UNVERIFIED_UPLOAD");
  }

  return {
    ...state,
    url: storageKeyToPublicUrl(state.publicId),
  };
}

export function readVerifiedDescriptor(
  handle: VerifiedDescriptor,
): VerifiedState {
  const state = verifiedDescriptor.get(handle as object);

  if (!state) {
    throw new UploadLifecycleError("UNVERIFIED_DESCRIPTOR");
  }

  return { ...state };
}

export function readVerifiedCleanupCapability(
  handle: VerifiedCleanupCapability,
): VerifiedState {
  const state = verifiedCleanup.get(handle as object);

  if (!state) {
    throw new UploadLifecycleError("UNVERIFIED_CLEANUP");
  }

  return { ...state };
}

export function parseExpectedUpdatedAt(value: unknown): Date {
  if (typeof value !== "string" || value.length === 0) {
    throw new UploadLifecycleError("INVALID_EXPECTED_UPDATED_AT");
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new UploadLifecycleError("INVALID_EXPECTED_UPDATED_AT");
  }

  return date;
}

export function matchesExpectedUpdatedAt(value: string, actual: Date): boolean {
  return parseExpectedUpdatedAt(value).getTime() === actual.getTime();
}

export { getUtcYearMonthPartition };

import { createHash } from "node:crypto";
import { Prisma } from "@generated/prisma/client";

export type UploadLockEntity = { model: string; id: string };

export type UploadLockPlan = {
  entities: UploadLockEntity[];
  fileKeys: string[];
};

export type NormalizedUploadLockPlan = Readonly<{
  entities: readonly UploadLockEntity[];
  fileKeys: readonly string[];
}>;

export type UploadLifecycleTransaction = Prisma.TransactionClient;

export type LockedLifecycle = {
  readonly __phase: "locked-lifecycle";
};

type LockedLifecycleState = {
  plan: NormalizedUploadLockPlan;
  transaction: UploadLifecycleTransaction;
};

const lockedLifecycleStates = new WeakMap<object, LockedLifecycleState>();

function assertCanonicalLockFileKey(fileKey: string): void {
  if (
    typeof fileKey !== "string" ||
    fileKey.length === 0 ||
    fileKey !== fileKey.trim() ||
    !classifyManagedStorageKey(fileKey) ||
    storageKeyToPublicUrl(fileKey) !== `/uploads/${fileKey}`
  ) {
    throw new UploadLifecycleError("INVALID_LOCK_FILE_KEY");
  }
}

export function normalizeUploadLockPlan(
  plan: UploadLockPlan,
): NormalizedUploadLockPlan {
  if (!plan || !Array.isArray(plan.entities) || !Array.isArray(plan.fileKeys)) {
    throw new UploadLifecycleError("INVALID_LOCK_PLAN");
  }

  const entities = new Map<string, UploadLockEntity>();

  for (const entity of plan.entities) {
    if (
      !entity ||
      typeof entity.model !== "string" ||
      typeof entity.id !== "string" ||
      entity.model.length === 0 ||
      entity.id.length === 0 ||
      entity.model.length > 128 ||
      entity.id.length > 256
    ) {
      throw new UploadLifecycleError("INVALID_LOCK_ENTITY");
    }

    entities.set(`${entity.model.length}:${entity.model}:${entity.id}`, {
      model: entity.model,
      id: entity.id,
    });
  }

  const fileKeys = new Set<string>();
  for (const fileKey of plan.fileKeys) {
    assertCanonicalLockFileKey(fileKey);
    fileKeys.add(fileKey);
  }

  return Object.freeze({
    entities: Object.freeze(
      [...entities.values()].sort((a, b) =>
        a.model.localeCompare(b.model) || a.id.localeCompare(b.id),
      ),
    ),
    fileKeys: Object.freeze([...fileKeys].sort((a, b) => a.localeCompare(b))),
  });
}

export function encodeUploadAdvisoryKey(
  namespace: "entity" | "file",
  value: string,
): bigint {
  if (
    (namespace !== "entity" && namespace !== "file") ||
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new UploadLifecycleError("INVALID_ADVISORY_KEY");
  }

  const digest = createHash("sha256")
    .update(`fraud-app/upload-lock/v1\n${namespace}\n${value}`)
    .digest();
  // PostgreSQL advisory locks take a signed bigint. Keep the hash in its
  // positive 63-bit range so the raw-query parameter cannot overflow.
  const key =
    (BigInt(digest.readUInt32BE(0) & 0x7fffffff) << BigInt(32)) |
    BigInt(digest.readUInt32BE(4));

  return key === BigInt(0) ? BigInt(1) : key;
}

export async function acquireUploadLifecycleLocks(
  tx: UploadLifecycleTransaction,
  plan: UploadLockPlan,
): Promise<LockedLifecycle> {
  if (!tx || typeof tx.$executeRaw !== "function") {
    throw new UploadLifecycleError("INVALID_TRANSACTION");
  }

  const normalized = normalizeUploadLockPlan(plan);

  for (const entity of normalized.entities) {
    const value = `entity:${entity.model}:${entity.id}`;
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(${encodeUploadAdvisoryKey("entity", value)})`,
    );
  }

  for (const fileKey of normalized.fileKeys) {
    const value = `file:${fileKey}`;
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(${encodeUploadAdvisoryKey("file", value)})`,
    );
  }

  const lifecycle = Object.freeze({ __phase: "locked-lifecycle" as const });
  lockedLifecycleStates.set(lifecycle, { plan: normalized, transaction: tx });
  return lifecycle;
}

function lockedState(lifecycle: LockedLifecycle): LockedLifecycleState {
  const state = lockedLifecycleStates.get(lifecycle as object);
  if (!state) throw new UploadLifecycleError("UNLOCKED_LIFECYCLE");
  return state;
}

export function getUploadLifecycleTransaction(
  lifecycle: LockedLifecycle,
): UploadLifecycleTransaction {
  return lockedState(lifecycle).transaction;
}

function requireEntity(
  lifecycle: LockedLifecycle,
  model: string,
  id: string,
): void {
  if (!lockedState(lifecycle).plan.entities.some(
    (entity) => entity.model === model && entity.id === id,
  )) {
    throw new UploadLifecycleError("OWNER_NOT_LOCKED");
  }
}

type OwnerRecord = {
  rowRef: object;
  lifecycle: object;
  kind: "ActivityPhoto" | "ProgramBudaya" | "ProgramCategory" |
    "LoginBanner" | "PicImportantInformation";
  id: string;
  reportId?: string;
  field: string;
  fileKey: string;
};

export type UploadOwnerLocator = { readonly __phase: "captured-owner" };
const ownerStates = new WeakMap<object, OwnerRecord>();

function captureOwner(
  lifecycle: LockedLifecycle,
  row: object,
  kind: OwnerRecord["kind"],
  id: string,
  field: string,
  persistedValue: string,
  reportId?: string,
): UploadOwnerLocator {
  if (!row || typeof persistedValue !== "string") {
    throw new UploadLifecycleError("INVALID_OWNER_ROW");
  }

  const fileKey = persistedValue.startsWith("/uploads/")
    ? persistedValue.slice("/uploads/".length)
    : persistedValue;
  assertCanonicalLockFileKey(fileKey);
  requireEntity(lifecycle, kind, id);
  if (reportId !== undefined) requireEntity(lifecycle, "ActivityReport", reportId);

  const handle = Object.freeze({ __phase: "captured-owner" as const });
  ownerStates.set(handle, {
    rowRef: row,
    lifecycle: lifecycle as object,
    kind,
    id,
    reportId,
    field,
    fileKey,
  });
  return handle;
}

export async function captureActivityPhotoOwner(
  lifecycle: LockedLifecycle,
  locator: { id: number; expectedReportId: string },
  field: "imageUrl" | "publicId",
): Promise<UploadOwnerLocator> {
  assertUuid(locator.expectedReportId, "REPORT");
  requireEntity(lifecycle, "ActivityPhoto", String(locator.id));
  requireEntity(lifecycle, "ActivityReport", locator.expectedReportId);
  const row = await lockedState(lifecycle).transaction.activityPhoto.findUnique({
    where: { id: locator.id },
    select: { id: true, reportId: true, imageUrl: true, publicId: true },
  });
  if (!row || row.reportId !== locator.expectedReportId) {
    throw new UploadLifecycleError("OWNER_MISMATCH");
  }
  const value = field === "imageUrl" ? row.imageUrl : row.publicId;
  if (!value) throw new UploadLifecycleError("INVALID_OWNER_ROW");
  return captureOwner(
    lifecycle,
    row,
    "ActivityPhoto",
    String(locator.id),
    `ActivityPhoto.${field}`,
    value,
    locator.expectedReportId,
  );
}

async function captureSimpleOwner(
  lifecycle: LockedLifecycle,
  locator: { id: string },
  kind: Exclude<OwnerRecord["kind"], "ActivityPhoto">,
  field: string,
  delegate: { findUnique(args: unknown): Promise<{ id: string; [key: string]: unknown } | null> },
): Promise<UploadOwnerLocator> {
  assertUuid(locator.id, "OWNER_ID");
  requireEntity(lifecycle, kind, locator.id);
  const row = await delegate.findUnique({
    where: { id: locator.id },
    select: { id: true, [field.split(".")[1]]: true },
  });
  if (!row) throw new UploadLifecycleError("OWNER_NOT_FOUND");
  const persistedValue = row[field.split(".")[1]];
  if (typeof persistedValue !== "string" || persistedValue.length === 0) {
    throw new UploadLifecycleError("INVALID_OWNER_ROW");
  }
  return captureOwner(lifecycle, row, kind, locator.id, field, persistedValue);
}

export async function captureProgramBudayaOwner(
  lifecycle: LockedLifecycle,
  locator: { id: string },
): Promise<UploadOwnerLocator> {
  return captureSimpleOwner(
    lifecycle, locator, "ProgramBudaya", "ProgramBudaya.bannerUrl",
    lockedState(lifecycle).transaction.programBudaya,
  );
}

export async function captureProgramCategoryOwner(
  lifecycle: LockedLifecycle,
  locator: { id: string },
): Promise<UploadOwnerLocator> {
  return captureSimpleOwner(
    lifecycle, locator, "ProgramCategory", "ProgramCategory.bannerUrl",
    lockedState(lifecycle).transaction.programCategory,
  );
}

export async function captureLoginBannerOwner(
  lifecycle: LockedLifecycle,
  locator: { id: string },
): Promise<UploadOwnerLocator> {
  return captureSimpleOwner(
    lifecycle, locator, "LoginBanner", "LoginBanner.imageUrl",
    lockedState(lifecycle).transaction.loginBanner,
  );
}

export async function capturePicImportantInformationOwner(
  lifecycle: LockedLifecycle,
  locator: { id: string },
): Promise<UploadOwnerLocator> {
  return captureSimpleOwner(
    lifecycle, locator, "PicImportantInformation", "PicImportantInformation.imageUrl",
    lockedState(lifecycle).transaction.picImportantInformation,
  );
}

export type PersistedOldCleanup = { readonly __phase: "persisted-old-cleanup" };
const persistedCleanupStates = new WeakMap<object, {
  owner: UploadOwnerLocator;
  fileKey: string;
}>();

export function capturePersistedOldCleanup(
  lifecycle: LockedLifecycle,
  owner: UploadOwnerLocator,
): PersistedOldCleanup {
  const ownerState = ownerStates.get(owner as object);
  const state = lockedState(lifecycle);

  if (!ownerState || ownerState.lifecycle !== (lifecycle as object)) {
    throw new UploadLifecycleError("UNVERIFIED_OWNER");
  }

  if (!state.plan.fileKeys.includes(ownerState.fileKey)) {
    throw new UploadLifecycleError("OLD_FILE_NOT_LOCKED");
  }

  const cleanup = Object.freeze({ __phase: "persisted-old-cleanup" as const });
  persistedCleanupStates.set(cleanup, { owner, fileKey: ownerState.fileKey });
  return cleanup;
}

export function readPersistedOldCleanup(cleanup: PersistedOldCleanup) {
  const state = persistedCleanupStates.get(cleanup as object);
  if (!state) throw new UploadLifecycleError("UNVERIFIED_PERSISTED_OLD_CLEANUP");
  return { ...state };
}

export type UploadReferenceOwner = Readonly<{
  kind:
    | "ActivityPhoto"
    | "ProgramBudaya"
    | "ProgramCategory"
    | "LoginBanner"
    | "PicImportantInformation";
  id: string;
  reportId?: string;
}>;

export type UploadReferenceLocation = {
  owner: UploadReferenceOwner;
  field:
    | "ActivityPhoto.imageUrl"
    | "ActivityPhoto.publicId"
    | "ProgramCategory.bannerUrl"
    | "ProgramBudaya.bannerUrl"
    | "LoginBanner.imageUrl"
    | "PicImportantInformation.imageUrl";
};

export async function findUploadReferences(
  lifecycle: LockedLifecycle,
  fileKey: string,
): Promise<UploadReferenceLocation[]> {
  const state = lockedState(lifecycle);
  assertCanonicalLockFileKey(fileKey);
  if (!state.plan.fileKeys.includes(fileKey)) {
    throw new UploadLifecycleError("REFERENCE_FILE_NOT_LOCKED");
  }

  const values = [fileKey, storageKeyToPublicUrl(fileKey)];
  const client = state.transaction;
  const locations: UploadReferenceLocation[] = [];

  const photos = await client.activityPhoto.findMany({
    where: { OR: [{ imageUrl: { in: values } }, { publicId: fileKey }] },
    select: { id: true, reportId: true, imageUrl: true, publicId: true },
  });
  for (const photo of photos) {
    if (values.includes(photo.imageUrl)) {
      locations.push({
        owner: { kind: "ActivityPhoto", id: String(photo.id), reportId: photo.reportId },
        field: "ActivityPhoto.imageUrl",
      });
    }
    if (photo.publicId === fileKey) {
      locations.push({
        owner: { kind: "ActivityPhoto", id: String(photo.id), reportId: photo.reportId },
        field: "ActivityPhoto.publicId",
      });
    }
  }

  const categories = await client.programCategory.findMany({
    where: { bannerUrl: { in: values } },
    select: { id: true, bannerUrl: true },
  });
  for (const row of categories) {
    locations.push({ owner: { kind: "ProgramCategory", id: row.id }, field: "ProgramCategory.bannerUrl" });
  }

  const programs = await client.programBudaya.findMany({
    where: { bannerUrl: { in: values } },
    select: { id: true, bannerUrl: true },
  });
  for (const row of programs) {
    locations.push({ owner: { kind: "ProgramBudaya", id: row.id }, field: "ProgramBudaya.bannerUrl" });
  }

  const banners = await client.loginBanner.findMany({
    where: { imageUrl: { in: values } },
    select: { id: true, imageUrl: true },
  });
  for (const row of banners) {
    locations.push({ owner: { kind: "LoginBanner", id: row.id }, field: "LoginBanner.imageUrl" });
  }

  const information = await client.picImportantInformation.findMany({
    where: { imageUrl: { in: values } },
    select: { id: true, imageUrl: true },
  });
  for (const row of information) {
    locations.push({ owner: { kind: "PicImportantInformation", id: row.id }, field: "PicImportantInformation.imageUrl" });
  }

  return locations;
}

export type UploadLifecyclePrismaClient = {
  $transaction<T>(
    callback: (transaction: UploadLifecycleTransaction) => Promise<T>,
  ): Promise<T>;
};

export type UploadLifecycleCleanupOutcome =
  | { kind: "deleted"; fileKey: string }
  | { kind: "missing"; fileKey: string }
  | { kind: "retained"; fileKey: string }
  | { kind: "failed"; fileKey: string };

/**
 * Run lifecycle work on one pinned interactive transaction.  Lock acquisition
 * is deliberately inside the transaction callback so all subsequent reads,
 * writes, and reference checks use the same connection.
 */
export async function withUploadLifecycleTransaction<T>(
  client: UploadLifecyclePrismaClient,
  plan: UploadLockPlan,
  callback: (lifecycle: LockedLifecycle) => Promise<T>,
): Promise<T> {
  if (!client || typeof client.$transaction !== "function") {
    throw new UploadLifecycleError("INVALID_PRISMA_CLIENT");
  }

  return client.$transaction(async (tx) => {
    const lifecycle = await acquireUploadLifecycleLocks(tx, plan);
    return callback(lifecycle);
  });
}

async function cleanUnreferencedFile(
  lifecycle: LockedLifecycle,
  fileKey: string,
): Promise<UploadLifecycleCleanupOutcome> {
  const references = await findUploadReferences(lifecycle, fileKey);
  if (references.length > 0) return { kind: "retained", fileKey };

  try {
    const result = await deleteManagedUploadFile(fileKey);
    return { kind: result.kind, fileKey };
  } catch {
    // The DB transaction has no mutation to roll back.  Keep the committed
    // state intact and return an inspectable orphan-cleanup result.
    return { kind: "failed", fileKey };
  }
}

/**
 * Roll back a newly written file after a failed persistence attempt.
 * The opaque handle is the only accepted authority for the file identity.
 */
export async function rollbackVerifiedNewUpload(
  client: UploadLifecyclePrismaClient,
  upload: VerifiedNewUpload,
): Promise<UploadLifecycleCleanupOutcome> {
  const state = readVerifiedNewUpload(upload);

  return withUploadLifecycleTransaction(
    client,
    { entities: [], fileKeys: [state.publicId] },
    (lifecycle) => cleanUnreferencedFile(lifecycle, state.publicId),
  );
}

/**
 * Clean an old persisted file only after its replacing DB mutation commits.
 * A filesystem failure is represented as `failed`; it never rejects the
 * already-successful database operation through this helper.
 */
export async function cleanupPersistedOldUploadAfterCommit(
  client: UploadLifecyclePrismaClient,
  cleanup: PersistedOldCleanup,
): Promise<UploadLifecycleCleanupOutcome> {
  const state = readPersistedOldCleanup(cleanup);

  return withUploadLifecycleTransaction(
    client,
    { entities: [], fileKeys: [state.fileKey] },
    (lifecycle) => cleanUnreferencedFile(lifecycle, state.fileKey),
  );
}
