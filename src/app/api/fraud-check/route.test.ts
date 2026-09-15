import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";

const requireAuthMock = mock.fn(async () => ({
  user: { id: "user-1", role: "PIC", authProvider: "LOCAL" },
}));
const findManyMock = mock.fn(async () => []);
const resolveScopeMock = mock.fn(async () => ({ whereClause: {} }));
const fetchMock = mock.fn<typeof fetch>();

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    requireAuth: requireAuthMock,
    handleApiError: (error: unknown) =>
      Response.json(
        { error: true, message: error instanceof Error ? error.message : "internal" },
        { status: 500 },
      ),
  },
});
mock.module("@/lib/api/rate-limit", {
  namedExports: {
    checkRateLimit: () => ({ success: true, resetAt: Date.now() + 60_000 }),
    rateLimitResponse: () => Response.json({}, { status: 429 }),
  },
});
mock.module("@/lib/api/unit-scope", {
  namedExports: { resolveScope: resolveScopeMock },
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
  fetchMock.mock.resetCalls();
  findManyMock.mock.resetCalls();
  resolveScopeMock.mock.resetCalls();
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
