interface RateLimitStore {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitStore>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store.entries()) {
      if (val.resetAt <= now) store.delete(key);
    }
  }, 60_000);
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
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

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const key = `${prefix}:${ip}`;
  const now = Date.now();

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
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
