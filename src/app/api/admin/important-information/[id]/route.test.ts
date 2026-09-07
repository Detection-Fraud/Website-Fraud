import { NextRequest } from "next/server";
import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";

type ImportantInformationRecord = {
  id: string;
  imageUrl: string;
  altText: string;
  width: number;
  height: number;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const authMock = mock.fn<
  () => Promise<{ user: { id: string; role: string } } | null>
>(async () => ({
  user: { id: "admin-1", role: "ADMIN" },
}));

const storedImageMock = mock.fn(async (_file: File) => ({
  imageUrl: "/uploads/important-information/new-uuid.png",
  width: 400,
  height: 200,
}));

const rollbackMock = mock.fn(async (_imageUrl: string) => {});
const deleteMock = mock.fn(async (_imageUrl: string) => {});

const items: ImportantInformationRecord[] = [];
let orderState = { id: "global", revision: 0, updatedAt: new Date() };
const advisoryKeys: string[] = [];
const itemUpdateMock = mock.fn(
  async ({
    where,
    data,
  }: {
    where: { id: string };
    data: Partial<ImportantInformationRecord>;
  }) => {
    const item = items.find((i) => i.id === where.id);
    if (item) {
      Object.assign(item, data, { updatedAt: new Date() });
      return { ...item };
    }
    return null;
  },
);

const tx = {
  picImportantInformation: {
    findUnique: mock.fn(
      async ({ where }: { where: { id: string } }) => {
        const found = items.find((i) => i.id === where.id);
        return found ? { ...found } : null;
      },
    ),
    findMany: mock.fn(async () => [...items]),
    delete: mock.fn(async ({ where }: { where: { id: string } }) => {
      const index = items.findIndex((i) => i.id === where.id);
      if (index !== -1) {
        return items.splice(index, 1)[0];
      }
      return null;
    }),
    update: mock.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ImportantInformationRecord>;
      }) => {
        const item = items.find((i) => i.id === where.id);
        if (item) {
          Object.assign(item, data, { updatedAt: new Date() });
          return { ...item };
        }
        return null;
      },
    ),
  },
  picImportantInformationOrderState: {
    findUnique: mock.fn(async () => ({ ...orderState })),
    update: mock.fn(async ({ data }: { data: { revision: number } }) => {
      orderState.revision = data.revision;
      orderState.updatedAt = new Date();
      return { ...orderState };
    }),
  },
  $queryRaw: mock.fn(async (query: { values: unknown[] }) => {
    advisoryKeys.push(String(query.values[0]));
    return [];
  }),
};

const transactionMock = mock.fn(
  async (callback: (transaction: typeof tx) => Promise<unknown>) => {
    return await callback(tx);
  },
);

mock.module("@/auth", {
  namedExports: { auth: authMock },
});

mock.module("@generated/prisma", {
  namedExports: {
    Prisma: {
      TransactionIsolationLevel: { Serializable: "Serializable" },
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
      }),
    },
  },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      picImportantInformation: {
        findUnique: mock.fn(
          async ({ where }: { where: { id: string } }) => {
            const found = items.find((i) => i.id === where.id);
            return found ? { ...found } : null;
          },
        ),
        update: itemUpdateMock,
      },
      picImportantInformationOrderState: {
        findUnique: mock.fn(async () => ({ ...orderState })),
      },
      $transaction: transactionMock,
    },
  },
});

mock.module("@/lib/api/important-information-storage", {
  namedExports: {
    validateAndStoreImportantInformationImage: storedImageMock,
    rollbackImportantInformationImage: rollbackMock,
    deleteImportantInformationImage: deleteMock,
    ImportantInformationStorageError: class extends Error {
      constructor(
        public readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "ImportantInformationStorageError";
      }
    },
    MAX_IMAGE_BYTES: 2 * 1024 * 1024,
    MAX_INPUT_PIXELS: 40_000_000,
    IMPORTANT_INFORMATION_NAMESPACE: "important-information",
  },
});

let PATCH: (
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => Promise<Response>;
let DELETE: (
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => Promise<Response>;

const validId = "123e4567-e89b-12d3-a456-426614174000";
const secondId = "123e4567-e89b-12d3-a456-426614174001";

before(async () => {
  const route = await import("./route");
  PATCH = route.PATCH;
  DELETE = route.DELETE;
});

beforeEach(() => {
  authMock.mock.mockImplementation(async () => ({
    user: { id: "admin-1", role: "ADMIN" },
  }));
  items.length = 0;
  advisoryKeys.length = 0;
  orderState = { id: "global", revision: 0, updatedAt: new Date() };
  transactionMock.mock.mockImplementation(async (cb) => cb(tx));
  storedImageMock.mock.mockImplementation(async () => ({
    imageUrl: "/uploads/important-information/new-uuid.png",
    width: 400,
    height: 200,
  }));
  rollbackMock.mock.resetCalls();
  deleteMock.mock.resetCalls();
  itemUpdateMock.mock.resetCalls();

  items.push({
    id: validId,
    imageUrl: "/uploads/important-information/old-uuid.png",
    altText: "Banner Lama",
    width: 300,
    height: 150,
    order: 0,
    isActive: true,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
  });
});

test("PATCH & DELETE return 401 for unauth and 403 for non-admin", async () => {
  authMock.mock.mockImplementationOnce(async () => null);
  const unauthPatch = await PATCH(new Request("http://localhost"), {
    params: Promise.resolve({ id: validId }),
  });
  assert.equal(unauthPatch.status, 401);

  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", role: "PIC" },
  }));
  const forbiddenDelete = await DELETE(new Request("http://localhost"), {
    params: Promise.resolve({ id: validId }),
  });
  assert.equal(forbiddenDelete.status, 403);
});

test("PATCH returns 400 for invalid UUID and 404 for not found", async () => {
  const badUuid = await PATCH(new Request("http://localhost"), {
    params: Promise.resolve({ id: "not-a-uuid" }),
  });
  assert.equal(badUuid.status, 400);

  const notFoundId = "00000000-0000-0000-0000-000000000000";
  const formData = new FormData();
  formData.append("altText", "Updated");
  const req = new NextRequest("http://localhost", {
    method: "PATCH",
    body: formData,
  });

  const notFound = await PATCH(req, {
    params: Promise.resolve({ id: notFoundId }),
  });
  assert.equal(notFound.status, 404);
});

test("PATCH returns a safe 400 for malformed multipart request", async () => {
  const req = new Request("http://localhost", {
    method: "PATCH",
    headers: { "content-type": "multipart/form-data; boundary=broken" },
    body: "not multipart",
  });

  const res = await PATCH(req, {
    params: Promise.resolve({ id: validId }),
  });
  assert.equal(res.status, 400);
});

test("PATCH updates altText only and preserves existing image when no file uploaded", async () => {
  const formData = new FormData();
  formData.append("altText", "Banner Diperbarui");

  const req = new NextRequest("http://localhost", {
    method: "PATCH",
    body: formData,
  });

  const res = await PATCH(req, {
    params: Promise.resolve({ id: validId }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.altText, "Banner Diperbarui");
  assert.equal(
    json.data.imageUrl,
    "/uploads/important-information/old-uuid.png",
  );
  assert.equal(deleteMock.mock.calls.length, 0);
});

test("PATCH updates image and deletes old image after successful commit", async () => {
  const formData = new FormData();
  formData.append("altText", "Banner Gambar Baru");
  formData.append(
    "file",
    new File(["dummy"], "new.png", { type: "image/png" }),
  );

  const req = new NextRequest("http://localhost", {
    method: "PATCH",
    body: formData,
  });

  const res = await PATCH(req, {
    params: Promise.resolve({ id: validId }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(
    json.data.imageUrl,
    "/uploads/important-information/new-uuid.png",
  );
  assert.equal(deleteMock.mock.calls.length, 1);
  assert.equal(
    deleteMock.mock.calls[0].arguments[0],
    "/uploads/important-information/old-uuid.png",
  );
});

test("PATCH rolls back the replacement and preserves the old image when DB update fails", async () => {
  const formData = new FormData();
  formData.append("altText", "Gagal diperbarui");
  formData.append("file", new File(["dummy"], "new.png", { type: "image/png" }));
  const req = new NextRequest("http://localhost", { method: "PATCH", body: formData });
  itemUpdateMock.mock.mockImplementationOnce(async () => {
    throw new Error("database failure");
  });

  const res = await PATCH(req, { params: Promise.resolve({ id: validId }) });
  assert.equal(res.status, 500);
  assert.equal(rollbackMock.mock.calls.length, 1);
  assert.equal(rollbackMock.mock.calls[0].arguments[0], "/uploads/important-information/new-uuid.png");
  assert.equal(deleteMock.mock.calls.length, 0);
  assert.equal(items[0].imageUrl, "/uploads/important-information/old-uuid.png");
});

test("PATCH does not fail after committed replacement if old-file cleanup fails", async () => {
  const formData = new FormData();
  formData.append("altText", "Gambar baru");
  formData.append("file", new File(["dummy"], "new.png", { type: "image/png" }));
  const req = new NextRequest("http://localhost", { method: "PATCH", body: formData });
  deleteMock.mock.mockImplementationOnce(async () => {
    throw new Error("cleanup failure");
  });

  const res = await PATCH(req, { params: Promise.resolve({ id: validId }) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.imageUrl, "/uploads/important-information/new-uuid.png");
  assert.equal(items[0].imageUrl, "/uploads/important-information/new-uuid.png");
});

test("PATCH rejects client-controlled fields", async () => {
  const formData = new FormData();
  formData.append("altText", "Tidak valid");
  formData.append("imageUrl", "/uploads/other.png");
  const res = await PATCH(
    new NextRequest("http://localhost", { method: "PATCH", body: formData }),
    { params: Promise.resolve({ id: validId }) },
  );
  assert.equal(res.status, 400);
  assert.equal(items[0].altText, "Banner Lama");
});

test("DELETE locks order, deletes target, compacts remaining orders, and increments revision", async () => {
  items.push({
    id: secondId,
    imageUrl: "/uploads/important-information/second.png",
    altText: "Item Kedua",
    width: 400,
    height: 200,
    order: 1,
    isActive: true,
    createdAt: new Date("2026-09-01T11:00:00.000Z"),
    updatedAt: new Date("2026-09-01T11:00:00.000Z"),
  });

  const res = await DELETE(new Request("http://localhost"), {
    params: Promise.resolve({ id: validId }),
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.error, false);
  assert.equal(json.data.revision, 1);
  assert.equal(json.data.items.length, 1);
  assert.equal(json.data.items[0].id, secondId);
  assert.equal(json.data.items[0].order, 0); // compacted to 0
  assert.equal(advisoryKeys[0], "important-information:global-order");
  assert.equal(deleteMock.mock.calls.length, 1);
});

test("DELETE keeps the committed response when file cleanup fails", async () => {
  deleteMock.mock.mockImplementationOnce(async () => {
    throw new Error("cleanup failure");
  });

  const res = await DELETE(new Request("http://localhost"), {
    params: Promise.resolve({ id: validId }),
  });

  assert.equal(res.status, 200);
  assert.equal(items.length, 0);
  assert.equal((await res.json()).data.revision, 1);
});

test("DELETE returns 404 for a valid but unknown ID", async () => {
  const res = await DELETE(new Request("http://localhost"), {
    params: Promise.resolve({
      id: "00000000-0000-0000-0000-000000000000",
    }),
  });
  assert.equal(res.status, 404);
});
