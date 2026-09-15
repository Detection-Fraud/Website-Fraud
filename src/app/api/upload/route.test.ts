import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";

class TestApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let currentUserId = "user-1";
const requireAuthMock = mock.fn(async () => ({
  user: { id: currentUserId, role: "ADMIN", authProvider: "LOCAL" },
}));
const mkdirMock = mock.fn(async () => undefined);
const writeFileMock = mock.fn(async () => undefined);
const unlinkMock = mock.fn<(filePath: string) => Promise<void>>(
  async () => undefined,
);
const activityPhotoFindFirstMock = mock.fn<
  () => Promise<{ id: number } | null>
>(async () => null);
const programFindFirstMock = mock.fn<() => Promise<{ id: string } | null>>(
  async () => null,
);
const categoryFindFirstMock = mock.fn<() => Promise<{ id: string } | null>>(
  async () => null,
);
const bannerFindFirstMock = mock.fn<() => Promise<{ id: string } | null>>(
  async () => null,
);

const sharpMock = mock.fn(() => ({
  resize: () => ({
    jpeg: () => ({
      withMetadata: () => ({
        toBuffer: async () => Buffer.from([0xff, 0xd8, 0xff]),
      }),
    }),
  }),
}));

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: TestApiError,
    requireAuth: requireAuthMock,
    handleApiError: (error: unknown) => {
      const apiError = error instanceof TestApiError ? error : null;
      return Response.json(
        { error: true, message: apiError?.message ?? "internal" },
        { status: apiError?.status ?? 500 },
      );
    },
  },
});
mock.module("@/lib/api/rate-limit", {
  namedExports: {
    checkRateLimit: () => ({ success: true, resetAt: Date.now() + 60_000 }),
    rateLimitResponse: () => Response.json({}, { status: 429 }),
  },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      activityPhoto: { findFirst: activityPhotoFindFirstMock },
      programBudaya: { findFirst: programFindFirstMock },
      programCategory: { findFirst: categoryFindFirstMock },
      loginBanner: { findFirst: bannerFindFirstMock },
    },
  },
});
mock.module("fs/promises", {
  namedExports: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
    unlink: unlinkMock,
  },
});
mock.module("sharp", { defaultExport: sharpMock });

let POST: (request: Request) => Promise<Response>;
let DELETE: (request: Request) => Promise<Response>;

before(async () => {
  process.env.NEXTAUTH_SECRET = "upload-clean-test-secret";
  ({ POST, DELETE } = await import("./route"));
});

beforeEach(() => {
  currentUserId = "user-1";
  requireAuthMock.mock.resetCalls();
  mkdirMock.mock.resetCalls();
  writeFileMock.mock.resetCalls();
  unlinkMock.mock.resetCalls();
  activityPhotoFindFirstMock.mock.resetCalls();
  programFindFirstMock.mock.resetCalls();
  categoryFindFirstMock.mock.resetCalls();
  bannerFindFirstMock.mock.resetCalls();
});

function uploadRequest() {
  const formData = new FormData();
  formData.set(
    "file",
    new File([new Uint8Array([0xff, 0xd8, 0xff])], "foto.jpg", {
      type: "image/jpeg",
    }),
  );
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

async function uploadTemporaryFile() {
  const response = await POST(uploadRequest());
  assert.equal(response.status, 200);
  return response.json() as Promise<{
    publicId: string;
    cleanupToken: string;
  }>;
}

function deleteRequest(body: unknown) {
  return new Request("http://localhost/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function cleanupCredential(uploaded: {
  publicId: string;
  cleanupToken: string;
}) {
  return {
    publicId: uploaded.publicId,
    cleanupToken: uploaded.cleanupToken,
  };
}

test("uploaded temporary file can be deleted with its cleanup credential", async () => {
  const uploaded = await uploadTemporaryFile();

  assert.match(uploaded.publicId, /^[0-9a-f-]+\.jpg$/);
  assert.equal(typeof uploaded.cleanupToken, "string");
  assert.ok(uploaded.cleanupToken.length > 0);

  const deleteResponse = await DELETE(deleteRequest(cleanupCredential(uploaded)));
  const deleted = (await deleteResponse.json()) as { deleted: boolean };

  assert.equal(deleteResponse.status, 200);
  assert.equal(deleted.deleted, true);
  assert.equal(unlinkMock.mock.calls.length, 1);
  assert.match(
    String(unlinkMock.mock.calls[0].arguments[0]),
    new RegExp(`${uploaded.publicId.replace(".", "\\.")}$`),
  );
});

test("cleanup rejects path traversal and tampered credentials", async () => {
  const uploaded = await uploadTemporaryFile();

  const traversalResponse = await DELETE(
    deleteRequest({
      publicId: `../${uploaded.publicId}`,
      cleanupToken: uploaded.cleanupToken,
    }),
  );
  assert.equal(traversalResponse.status, 400);

  const tamperedResponse = await DELETE(
    deleteRequest({
      ...cleanupCredential(uploaded),
      cleanupToken: `${uploaded.cleanupToken}tampered`,
    }),
  );
  assert.equal(tamperedResponse.status, 403);
  assert.equal(unlinkMock.mock.calls.length, 0);
});

test("cleanup credential is bound to the authenticated uploader", async () => {
  const uploaded = await uploadTemporaryFile();
  currentUserId = "user-2";

  const response = await DELETE(deleteRequest(cleanupCredential(uploaded)));

  assert.equal(response.status, 403);
  assert.equal(unlinkMock.mock.calls.length, 0);
});

test("cleanup never removes an upload already referenced by persisted data", async () => {
  const uploaded = await uploadTemporaryFile();
  programFindFirstMock.mock.mockImplementationOnce(async () => ({
    id: "program-1",
  }));

  const response = await DELETE(deleteRequest(cleanupCredential(uploaded)));
  const body = (await response.json()) as { deleted: boolean };

  assert.equal(response.status, 200);
  assert.equal(body.deleted, false);
  assert.equal(unlinkMock.mock.calls.length, 0);
});
