interface RateLimitStore {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitStore>();
const MAX_RATE_LIMIT_ENTRIES = 4096;

function pruneExpiredEntries(now: number): void {
  for (const [key, value] of store) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

function evictEarliestEntry(): void {
  let earliestKey: string | null = null;
  let earliestResetAt = Number.POSITIVE_INFINITY;

  for (const [key, value] of store) {
    if (value.resetAt < earliestResetAt) {
      earliestKey = key;
      earliestResetAt = value.resetAt;
    }
  }

  if (earliestKey) {
    store.delete(earliestKey);
  }
}

if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store.entries()) {
      if (val.resetAt <= now) store.delete(key);
    }
  }, 60_000);

  if (
    typeof cleanupTimer === "object" &&
    cleanupTimer !== null &&
    "unref" in cleanupTimer &&
    typeof cleanupTimer.unref === "function"
  ) {
    cleanupTimer.unref();
  }
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  clientIdentity?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  request: Request,
  options: RateLimitOptions = {},
): RateLimitResult {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 30;
  const prefix = options.keyPrefix ?? "default";

  const ip = options.clientIdentity ?? getClientIdentity(request) ?? "unknown";

  const key = `${prefix}:${ip}`;
  const now = Date.now();
  pruneExpiredEntries(now);

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    if (!existing && store.size >= MAX_RATE_LIMIT_ENTRIES) {
      evictEarliestEntry();
    }

    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: max - 1, resetAt: now + windowMs };
  }

  if (existing.count >= max) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return {
    success: true,
    remaining: max - existing.count,
    resetAt: existing.resetAt,
  };
}

function getClientIdentity(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedClient = forwardedFor?.split(",", 1)[0]?.trim();
  if (forwardedClient) return forwardedClient;

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || null;
}

/**
 * Returns the identity supplied by the trusted ingress/WAF. Callers that
 * expose an unauthenticated public operation should reject requests without
 * this identity before invoking a per-client limiter.
 */
export function getTrustedClientIdentity(request: Request): string | null {
  const configuredHeader = process.env.TRUSTED_INGRESS_IDENTITY_HEADER?.trim();
  if (!configuredHeader) return null;
  if (["x-forwarded-for", "x-real-ip"].includes(configuredHeader.toLowerCase())) {
    return null;
  }

  return request.headers.get(configuredHeader)?.trim() || null;
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({
      success: false,
      error: true,
      message: "Terlalu banyak permintaan. Coba lagi dalam beberapa saat.",
      statusCode: 429,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    },
  );
}
