import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import type { resolveUploadReference } from "@/lib/api/upload-storage";

type UploadReferenceResolution = Awaited<ReturnType<typeof resolveUploadReference>>;
type ActivityPhotoReference = { originalName: string; imageUrl: string };

const requireAuthMock = mock.fn(async () => ({
  user: { id: "user-1", role: "PIC", authProvider: "LOCAL" },
}));
const findManyMock = mock.fn(async (): Promise<ActivityPhotoReference[]> => []);
const resolveUploadReferenceMock = mock.fn(async (reference: string): Promise<UploadReferenceResolution> => {
  void reference;
  return { kind: "unsafe" as const, reason: "test" };
});
const resolveScopeMock = mock.fn(async () => ({ whereClause: {} }));
const fetchMock = mock.fn<typeof fetch>();
const checkRateLimitMock = mock.fn((_request: Request, _options: { keyPrefix?: string; clientIdentity?: string; max?: number }) => {
  void _request;
  void _options;
  return { success: true, resetAt: Date.now() + 60_000 };
});
class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError,
    requireAuth: requireAuthMock,
    handleApiError: (error: unknown) =>
      Response.json(
        { error: true, message: error instanceof Error ? error.message : "internal" },
        { status: error instanceof ApiError ? error.status : 500 },
      ),
  },
});
mock.module("@/lib/api/rate-limit", {
  namedExports: {
    checkRateLimit: checkRateLimitMock,
    getTrustedClientIdentity: () => "same-ingress",
    rateLimitResponse: () => Response.json({}, { status: 429 }),
  },
});
mock.module("@/lib/api/unit-scope", {
  namedExports: { resolveScope: resolveScopeMock },
});
mock.module("@/lib/api/upload-storage", {
  namedExports: { resolveUploadReference: resolveUploadReferenceMock },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: { activityPhoto: { findMany: findManyMock } },
  },
});

let POST: (request: Request) => Promise<Response>;

before(async () => {
  process.env.PYTHON_API_URL = "http://127.0.0.1:8000/api/analyze-batch";
  process.env.PYTHON_API_KEY = "test-key";
  globalThis.fetch = fetchMock;
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  requireAuthMock.mock.mockImplementation(async () => ({ user: { id: "user-1", role: "PIC", authProvider: "LOCAL" } }));
  checkRateLimitMock.mock.resetCalls();
  checkRateLimitMock.mock.mockImplementation(() => ({ success: true, resetAt: Date.now() + 60_000 }));
  fetchMock.mock.resetCalls();
  findManyMock.mock.resetCalls();
  resolveScopeMock.mock.resetCalls();
  resolveUploadReferenceMock.mock.resetCalls();
});

test("uses separate authenticated user quotas for users sharing an ingress", async () => {
  const counts = new Map<string, number>();
  checkRateLimitMock.mock.mockImplementation((_request, options) => {
    const key = `${options.keyPrefix}:${options.clientIdentity}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return { success: count <= (options.max ?? 0), resetAt: Date.now() + 60_000 };
  });
  fetchMock.mock.mockImplementation(async () => Response.json({ detail_gambar: [] }));
  for (let i = 0; i < 5; i++) assert.equal((await POST(request())).status, 200);
  assert.equal((await POST(request())).status, 429);
  requireAuthMock.mock.mockImplementation(async () => ({ user: { id: "user-2", role: "PIC", authProvider: "LOCAL" } }));
  assert.equal((await POST(request())).status, 200);
  assert.equal(fetchMock.mock.calls.length, 6);
});

test("rejects invalid file counts and oversized files before DB access or Python", async () => {
  for (const [count, size, status] of [[3, 1, 400], [1, 2 * 1024 * 1024 + 1, 413]]) {
    const form = new FormData();
    for (let i = 0; i < count; i++) form.append("foto_baru", new File([new Uint8Array(size)], `photo${i}.jpg`, { type: "image/jpeg" }));
    assert.equal((await POST(new Request("http://localhost/api/fraud-check", { method: "POST", body: form }))).status, status);
  }
  assert.equal(findManyMock.mock.calls.length, 0);
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("bounds a streamed multipart body even without Content-Length", async () => {
  const oversized = new Request("http://localhost/api/fraud-check", {
    method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=test" },
    body: new Uint8Array(5 * 1024 * 1024 + 1),
  });
  assert.equal(oversized.headers.get("content-length"), null);
  assert.equal((await POST(oversized)).status, 413);
  assert.equal(findManyMock.mock.calls.length, 0);
  assert.equal(fetchMock.mock.calls.length, 0);
});

function request() {
  const formData = new FormData();
  formData.append(
    "foto_baru",
    new File([new Uint8Array([1, 2, 3])], "foto.jpg", {
      type: "image/jpeg",
    }),
  );

  return new Request("http://localhost/api/fraud-check", {
    method: "POST",
    body: formData,
  });
}

test("preserves the existing successful fraud-check response contract", async () => {
  fetchMock.mock.mockImplementationOnce(async () =>
    new Response(JSON.stringify({ detail_gambar: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  const response = await POST(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    status: 200,
    error: false,
    message: "Data berhasil dicek",
    data: { detail_gambar: [] },
  });
  assert.equal(fetchMock.mock.calls.length, 1);
});

test("maps Python 429 and forwards Retry-After without retrying", async () => {
  fetchMock.mock.mockImplementationOnce(async () =>
    new Response(JSON.stringify({ detail: "busy" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "7",
      },
    }),
  );

  const response = await POST(request());
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "7");
  assert.deepEqual(body, {
    status: 429,
    error: true,
    message: "Gagal memproses data di Python AI",
    data: null,
  });
  assert.equal(fetchMock.mock.calls.length, 1);
});

test("omits invalid Python Retry-After values", async () => {
  for (const retryAfter of ["0", "61", "1.5", "later"]) {
    fetchMock.mock.mockImplementationOnce(async () =>
      new Response(null, {
        status: 429,
        headers: { "Retry-After": retryAfter },
      }),
    );

    const response = await POST(request());

    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), null);
  }
  assert.equal(fetchMock.mock.calls.length, 4);
});

test("omits a missing Python Retry-After value", async () => {
  fetchMock.mock.mockImplementationOnce(async () =>
    new Response(null, { status: 429 }),
  );

  const response = await POST(request());

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), null);
  assert.equal(fetchMock.mock.calls.length, 1);
});

test("preserves browser File flow and only sends approved local/external references", async () => {
  const legacy = "/uploads/legacy.jpg";
  const nested = "/uploads/reports/11111111-1111-4111-8111-111111111111/2026/09/8f211111-1111-4111-8111-111111111111.jpg";
  const missing = "/uploads/reports/11111111-1111-4111-8111-111111111111/2026/09/9f211111-1111-4111-8111-111111111111.jpg";
  findManyMock.mock.mockImplementationOnce(async () => [
    { originalName: "legacy.jpg", imageUrl: legacy },
    { originalName: "nested.jpg", imageUrl: nested },
    { originalName: "external.jpg", imageUrl: "https://cdn.example.test/a.jpg" },
    { originalName: "missing.jpg", imageUrl: missing },
    { originalName: "unsafe.jpg", imageUrl: "file:///etc/passwd" },
  ]);
  resolveUploadReferenceMock.mock.mockImplementation(async (reference) => {
    if (reference === legacy) return { kind: "local" as const, storageKey: "legacy.jpg", source: "legacy-flat" as const, filePath: "C:\\uploads\\legacy.jpg", exists: true as const, isRegularFile: true as const };
    if (reference === nested) return { kind: "local" as const, storageKey: nested.slice(9), source: "report" as const, filePath: "C:\\uploads\\reports\\nested.jpg", exists: true as const, isRegularFile: true as const };
    if (reference === missing) return { kind: "missing" as const, storageKey: missing.slice(9), source: "report" as const };
    if (reference.startsWith("https://")) return { kind: "external-http" as const, url: reference };
    return { kind: "unsafe" as const, reason: "rejected" };
  });
  fetchMock.mock.mockImplementationOnce(async () => new Response(JSON.stringify({ detail_gambar: [] }), { status: 200 }));

  const response = await POST(request());
  assert.equal(response.status, 200);
  const init = fetchMock.mock.calls[0].arguments[1] as RequestInit;
  assert.ok(init.body instanceof FormData);
  assert.ok(init.body.get("foto_baru") instanceof File);
  const sent = JSON.parse(String(init.body.get("referensi_json"))) as Array<{ url: string }>;
  assert.equal(sent.length, 3);
  assert.equal(sent[2].url, "https://cdn.example.test/a.jpg");
  assert.equal(sent.some(({ url }) => url === missing), false);
  assert.equal(sent.some(({ url }) => url.startsWith("file:///etc")), false);
});
