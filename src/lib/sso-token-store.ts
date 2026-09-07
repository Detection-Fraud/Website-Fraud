import crypto from "crypto";

/**
 * Server-side store untuk melacak temporary SSO token yang sudah dikonsumsi.
 * Mencegah token replay walaupun JWT belum expired.
 *
 * Implementasi: In-memory Map dengan auto-cleanup.
 * Untuk multi-instance deployment (horizontal scaling), ganti dengan Redis.
 *
 * Cara kerja:
 * 1. Saat /api/auth/sso/token membaca cookie → hash token → cek apakah sudah consumed
 * 2. Jika belum → mark consumed → return token → reject semua request berikutnya
 * 3. Auto-cleanup entry setelah 2 menit (melampaui JWT expiry 1 menit)
 */

const consumedTokens = new Map<string, number>();
const issuedCredentials = new Map<string, number>();

const MAX_CONSUMED_TOKENS = 1024;
const MAX_ISSUED_CREDENTIALS = 1024;
const CREDENTIAL_TTL_MS = 60 * 1000;

const CLEANUP_INTERVAL_MS = 60 * 1000;
const TOKEN_TTL_MS = 2 * 60 * 1000;

let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupIfNeeded() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [hash, timestamp] of consumedTokens) {
      if (now - timestamp > TOKEN_TTL_MS) {
        consumedTokens.delete(hash);
      }
    }

    if (consumedTokens.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);

  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Hash token sebelum disimpan — kita tidak perlu menyimpan token asli di memory.
 * Ini defensive measure agar jika memory di-dump, token tidak terekspos.
 */

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function pruneIssuedCredentials(now: number): void {
  for (const [hash, expiresAt] of issuedCredentials) {
    if (now >= expiresAt) {
      issuedCredentials.delete(hash);
    }
  }
}

export function registerCredential(
  credential: string,
  ttlMs: number = CREDENTIAL_TTL_MS,
): boolean {
  const now = Date.now();
  pruneIssuedCredentials(now);

  if (issuedCredentials.size >= MAX_ISSUED_CREDENTIALS) {
    return false;
  }

  const hash = hashToken(credential);

  if (issuedCredentials.has(hash)) {
    return false;
  }

  issuedCredentials.set(hash, now + Math.min(ttlMs, CREDENTIAL_TTL_MS));
  return true;
}

export function consumeCredential(credential: string): boolean {
  const now = Date.now();
  pruneIssuedCredentials(now);

  const hash = hashToken(credential);

  if (!issuedCredentials.has(hash)) {
    return false;
  }

  issuedCredentials.delete(hash);
  return true;
}
/**
 * Coba consume token. Return `true` jika token belum pernah dipakai (first use).
 * Return `false` jika token sudah pernah di-consume sebelumnya (replay attempt).
 *
 * Ini adalah operasi ATOMIC — thread-safe di single-process Node.js.
 */

export function consumeToken(token: string): boolean {
  const now = Date.now();
  for (const [hash, timestamp] of consumedTokens) {
    if (now - timestamp > TOKEN_TTL_MS) {
      consumedTokens.delete(hash);
    }
  }

  const hash = hashToken(token);

  if (consumedTokens.has(hash)) {
    return false;
  }

  if (consumedTokens.size >= MAX_CONSUMED_TOKENS) {
    return false;
  }

  consumedTokens.set(hash, now);
  startCleanupIfNeeded();
  return true;
}
