import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveUploadReference, storageKeyToPublicUrl } from "@/lib/api/upload-storage";

const UPLOAD_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type LegacyUploadContext = {
  purpose: "EVIDENCE" | "PROGRAM_BANNER" | "CATEGORY_BANNER" | "LOGIN_BANNER";
  mode: "CREATE" | "REPLACEMENT";
  reportId?: string;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Upload signing secret is not configured");
  return secret;
}

function signature(kind: "cleanup" | "descriptor", publicId: string, userId: string, expiresAt: number, context?: LegacyUploadContext): string {
  const value = kind === "cleanup"
    ? `upload-cleanup\n${publicId}\n${userId}\n${expiresAt}`
    : `upload-descriptor\n${publicId}\n${userId}\n${context!.purpose}\n${context!.mode}\n${context!.reportId ?? ""}\n${expiresAt}`;
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function mint(kind: "cleanup" | "descriptor", publicId: string, userId: string, context?: LegacyUploadContext): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return `${expiresAt}.${signature(kind, publicId, userId, expiresAt, context)}`;
}

function verify(kind: "cleanup" | "descriptor", publicId: string, userId: string, token: string, context?: LegacyUploadContext): boolean {
  if (!UPLOAD_NAME_PATTERN.test(publicId) || typeof token !== "string") return false;
  const separator = token.indexOf(".");
  if (separator <= 0) return false;
  const expiresAt = Number(token.slice(0, separator));
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Date.now()) return false;
  const received = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(signature(kind, publicId, userId, expiresAt, context));
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function mintLegacyCleanupToken(publicId: string, userId: string): string {
  return mint("cleanup", publicId, userId);
}

export function verifyLegacyCleanupToken(publicId: string, userId: string, token: string): boolean {
  return verify("cleanup", publicId, userId, token);
}

export function mintLegacyUploadDescriptor(publicId: string, userId: string, context: LegacyUploadContext): string {
  return mint("descriptor", publicId, userId, context);
}

export function verifyLegacyUploadDescriptor(publicId: string, userId: string, token: string, context: LegacyUploadContext): boolean {
  return verify("descriptor", publicId, userId, token, context);
}

export async function verifyLegacyReportPhoto(
  photo: { publicId: string; imageUrl: string; descriptor: string; cleanupToken: string },
  userId: string,
  context: LegacyUploadContext,
): Promise<boolean> {
  if (
    !verifyLegacyUploadDescriptor(photo.publicId, userId, photo.descriptor, context) ||
    !verifyLegacyCleanupToken(photo.publicId, userId, photo.cleanupToken) ||
    photo.imageUrl !== storageKeyToPublicUrl(photo.publicId)
  ) return false;

  const resolved = await resolveUploadReference(photo.imageUrl);
  return resolved.kind === "local" && resolved.source === "legacy-flat" && resolved.exists;
}
