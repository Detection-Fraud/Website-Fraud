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

let currentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "ADMIN",
  unitId: undefined as string | undefined,
};
const requireAuthMock = mock.fn(async () => ({ user: currentUser }));
const fileHandle = {
  writeFile: mock.fn(async () => undefined),
  close: mock.fn(async () => undefined),
};
const openMock = mock.fn(async (path: string, flags: string) => {
  void path;
  void flags;
  return fileHandle;
});
const writePathMock = mock.fn(async (key: string) => `/tmp/uploads/${key}`);
const activityReportFindFirstMock = mock.fn(async () => null as {
  id: string;
  unitId: string;
} | null);
let mintedContext: unknown;

const sharpMock = mock.fn(() => ({
  resize: () => ({
    jpeg: () => ({
      withMetadata: () => ({
        toBuffer: async () => Buffer.from([0xff, 0xd8, 0xff]),
      }),
    }),
  }),
}));

const createServerOwnedUploadContextMock = mock.fn((input) => input);
const mintUploadDescriptorMock = mock.fn((context) => {
  mintedContext = context;
  return {
    descriptor: "descriptor-token",
    publicId: context.publicId,
    url: "/uploads/" + context.publicId,
    iat: 1,
    exp: 2,
  };
});
const mintCleanupTokenMock = mock.fn(() => "cleanup-token");
const verifyNewUploadMock = mock.fn((descriptor: string, cleanupToken: string, context: unknown) => {
  if (
    descriptor !== "descriptor-token" ||
    cleanupToken !== "cleanup-token" ||
    JSON.stringify(context) !== JSON.stringify(mintedContext)
  ) {
    throw new lifecycleErrorMock("INVALID_TOKEN");
  }
  return { __phase: "verified-new-upload", context };
});
const rollbackVerifiedNewUploadMock = mock.fn(async () => ({
  kind: "deleted",
  fileKey: "banners/programs/file.jpg",
}));
const validImage = Buffer.from(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABykX//Z",
  "base64",
);
const lifecycleErrorMock = class extends Error {
  constructor(public code: string) {
    super(code);
  }
};

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
mock.module("@/lib/api/upload-lifecycle", {
  namedExports: {
    createServerOwnedUploadContext: createServerOwnedUploadContextMock,
    mintUploadDescriptor: mintUploadDescriptorMock,
    mintCleanupToken: mintCleanupTokenMock,
    verifyNewUpload: verifyNewUploadMock,
    rollbackVerifiedNewUpload: rollbackVerifiedNewUploadMock,
    UploadLifecycleError: lifecycleErrorMock,
  },
});
mock.module("@/lib/api/upload-storage", {
  namedExports: {
    getUtcYearMonthPartition: (timestamp: Date) => ({
      year: String(timestamp.getUTCFullYear()).padStart(4, "0"),
      month: String(timestamp.getUTCMonth() + 1).padStart(2, "0"),
    }),
    prepareManagedUploadWritePath: writePathMock,
  },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      activityReport: { findFirst: activityReportFindFirstMock },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({}),
    },
  },
});
mock.module("node:fs/promises", {
  namedExports: {
    open: openMock,
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
  mintedContext = undefined;
  currentUser = {
    id: "11111111-1111-4111-8111-111111111111",
    role: "ADMIN",
    unitId: undefined,
  };
  requireAuthMock.mock.resetCalls();
  openMock.mock.resetCalls();
  fileHandle.writeFile.mock.resetCalls();
  fileHandle.close.mock.resetCalls();
  writePathMock.mock.resetCalls();
  activityReportFindFirstMock.mock.resetCalls();
  createServerOwnedUploadContextMock.mock.resetCalls();
  mintUploadDescriptorMock.mock.resetCalls();
  mintCleanupTokenMock.mock.resetCalls();
  verifyNewUploadMock.mock.resetCalls();
  rollbackVerifiedNewUploadMock.mock.resetCalls();
});

function uploadRequest(
  purpose?: string,
  mode?: string,
  reportId?: string,
  unitId?: string,
) {
  const formData = new FormData();
  formData.set(
    "file",
    new File([validImage], "foto.jpg", {
      type: "image/jpeg",
    }),
  );
  if (purpose !== undefined) formData.set("purpose", purpose);
  if (mode !== undefined) formData.set("mode", mode);
  if (reportId !== undefined) formData.set("reportId", reportId);
  if (unitId !== undefined) formData.set("unitId", unitId);
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

function deleteRequest(body: unknown) {
  return new Request("http://localhost/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}


test("menolak upload tanpa purpose dan mode", async () => {
  const response = await POST(uploadRequest());

  assert.equal(response.status, 400);
  assert.equal(openMock.mock.calls.length, 0);
});

test("menghasilkan structured key untuk program banner", async () => {
  const response = await POST(
    uploadRequest("PROGRAM_BANNER", "CREATE"),
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.match(
    body.publicId,
    /^banners\/programs\/[0-9a-f-]+\.jpg$/,
  );
  assert.equal(body.url, "/uploads/" + body.publicId);
  assert.equal(body.descriptor, "descriptor-token");
  assert.equal(body.cleanupToken, "cleanup-token");
  assert.equal(openMock.mock.calls[0].arguments[1], "wx");
  assert.equal(writePathMock.mock.calls[0].arguments[0], body.publicId);
});

test("menolak banner upload oleh PIC", async () => {
  currentUser = {
    id: "11111111-1111-4111-8111-111111111111",
    role: "PIC",
    unitId: "22222222-2222-4222-8222-222222222222",
  };

  const response = await POST(
    uploadRequest("PROGRAM_BANNER", "CREATE"),
  );

  assert.equal(response.status, 403);
  assert.equal(openMock.mock.calls.length, 0);
});

test("evidence ignores client unitId and uses unit from session", async () => {
  currentUser = {
    id: "11111111-1111-4111-8111-111111111111",
    role: "PIC",
    unitId: "22222222-2222-4222-8222-222222222222",
  };

  const response = await POST(
    uploadRequest(
      "EVIDENCE",
      "CREATE",
      undefined,
      "99999999-9999-4999-8999-999999999999",
    ),
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.match(
    body.publicId,
    /^reports\/22222222-2222-4222-8222-222222222222\/\d{4}\/\d{2}\/[0-9a-f-]+\.jpg$/,
  );
});

test("evidence replacement memakai report terotorisasi", async () => {
  currentUser = {
    id: "11111111-1111-4111-8111-111111111111",
    role: "PIC",
    unitId: "22222222-2222-4222-8222-222222222222",
  };

  activityReportFindFirstMock.mock.mockImplementationOnce(async () => ({
    id: "33333333-3333-4333-8333-333333333333",
    unitId: "22222222-2222-4222-8222-222222222222",
  }));

  const response = await POST(
    uploadRequest(
      "EVIDENCE",
      "REPLACEMENT",
      "33333333-3333-4333-8333-333333333333",
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(activityReportFindFirstMock.mock.calls.length, 1);
});

test("non-PIC evidence replacement ditolak sebelum lookup report", async () => {
  const response = await POST(
    uploadRequest(
      "EVIDENCE",
      "REPLACEMENT",
      "33333333-3333-4333-8333-333333333333",
    ),
  );

  assert.equal(response.status, 403);
  assert.equal(activityReportFindFirstMock.mock.callCount(), 0);
  assert.equal(openMock.mock.callCount(), 0);
});

test("DELETE membutuhkan descriptor dan cleanup token", async () => {
  const response = await DELETE(
    deleteRequest({
      publicId:
        "banners/programs/44444444-4444-4444-8444-444444444444.jpg",
      cleanupToken: "cleanup-token",
      purpose: "PROGRAM_BANNER",
      mode: "CREATE",
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(rollbackVerifiedNewUploadMock.mock.calls.length, 0);
});

async function uploadBannerCredential() {
  const response = await POST(uploadRequest("PROGRAM_BANNER", "CREATE"));
  assert.equal(response.status, 200);
  const body = await response.json();
  return {
    publicId: body.publicId,
    descriptor: body.descriptor,
    cleanupToken: body.cleanupToken,
    purpose: "PROGRAM_BANNER",
    mode: "CREATE",
  };
}

test("DELETE memverifikasi descriptor dan cleanup token", async () => {
  const credential = await uploadBannerCredential();
  verifyNewUploadMock.mock.resetCalls();
  const response = await DELETE(deleteRequest(credential));

  assert.equal(response.status, 200);
  assert.equal((await response.json()).deleted, true);
  assert.equal(verifyNewUploadMock.mock.calls.length, 1);
  assert.equal(rollbackVerifiedNewUploadMock.mock.calls.length, 1);
});

test("failed exclusive open does not roll back a key owned by another request", async () => {
  openMock.mock.mockImplementationOnce(async () => {
    throw Object.assign(new Error("exists"), { code: "EEXIST" });
  });

  const response = await POST(uploadRequest("PROGRAM_BANNER", "CREATE"));

  assert.equal(response.status, 500);
  assert.equal(rollbackVerifiedNewUploadMock.mock.callCount(), 0);
});

test("upload signing fails before preparing or writing a file", async () => {
  mintUploadDescriptorMock.mock.mockImplementationOnce(() => {
    throw new lifecycleErrorMock("UPLOAD_LIFECYCLE_UNAVAILABLE");
  });
  const response = await POST(uploadRequest("PROGRAM_BANNER", "CREATE"));
  assert.equal(response.status, 400);
  assert.equal(writePathMock.mock.callCount(), 0);
  assert.equal(openMock.mock.callCount(), 0);
});

test("cleanup rejects tampered credentials before deleting", async () => {
  const credential = await uploadBannerCredential();
  const tampered = await DELETE(deleteRequest({ ...credential, cleanupToken: "wrong" }));
  assert.equal(tampered.status, 403);
  assert.equal(rollbackVerifiedNewUploadMock.mock.callCount(), 0);

  const valid = await DELETE(deleteRequest(credential));
  assert.equal(valid.status, 200);
  assert.equal(rollbackVerifiedNewUploadMock.mock.callCount(), 1);
});
