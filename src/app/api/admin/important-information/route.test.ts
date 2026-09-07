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
  imageUrl: "/uploads/important-information/test-uuid.png",
  width: 400,
  height: 200,
}));

const rollbackMock = mock.fn(async (_imageUrl: string) => {});

const items: ImportantInformationRecord[] = [];
let orderState = { id: "global", revision: 0, updatedAt: new Date() };
const advisoryKeys: string[] = [];
const stateFindUniqueMock = mock.fn<
  () => Promise<{ id: string; revision: number; updatedAt: Date } | null>
>(async () => ({ ...orderState }));

const tx = {
  picImportantInformation: {
    findMany: mock.fn(async () => items.map((i) => ({ order: i.order }))),
    create: mock.fn(
      async ({
        data,
      }: {
        data: Omit<
          ImportantInformationRecord,
          "id" | "createdAt" | "updatedAt"
        >;
      }) => {
        const now = new Date("2026-09-01T10:00:00.000Z");
        const item: ImportantInformationRecord = {
          ...data,
          id: `item-${items.length + 1}`,
          createdAt: now,
          updatedAt: now,
        };
        items.push(item);
        return item;
      },
    ),
  },
  picImportantInformationOrderState: {
    findUnique: stateFindUniqueMock,
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
        findMany: mock.fn(async () => [...items]),
      },
      picImportantInformationOrderState: {
        findUnique: stateFindUniqueMock,
      },
      $transaction: transactionMock,
    },
  },
});

mock.module("@/lib/api/important-information-storage", {
  namedExports: {
    validateAndStoreImportantInformationImage: storedImageMock,
    rollbackImportantInformationImage: rollbackMock,
    deleteImportantInformationImage: mock.fn(async () => {}),
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

let GET: () => Promise<Response>;
let POST: (req: Request) => Promise<Response>;

before(async () => {
  const route = await import("./route");
  GET = route.GET;
  POST = route.POST;
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
    imageUrl: "/uploads/important-information/test-uuid.png",
    width: 400,
    height: 200,
  }));
  rollbackMock.mock.resetCalls();
  stateFindUniqueMock.mock.mockImplementation(async () => ({ ...orderState }));
});

test("GET returns 401 for unauthenticated and 403 for non-admin", async () => {
  authMock.mock.mockImplementationOnce(async () => null);
  const unauth = await GET();
  assert.equal(unauth.status, 401);

  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", role: "PIC" },
  }));
  const forbidden = await GET();
  assert.equal(forbidden.status, 403);
});

test("GET returns empty list and revision 0 when empty", async () => {
  const res = await GET();
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.error, false);
  assert.deepEqual(json.data.items, []);
  assert.equal(json.data.revision, 0);
});

test("GET returns sorted items and revision", async () => {
  items.push(
    {
      id: "b",
      imageUrl: "/uploads/b.png",
      altText: "B",
      width: 100,
      height: 100,
      order: 1,
      isActive: true,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    {
      id: "a",
      imageUrl: "/uploads/a.png",
      altText: "A",
      width: 100,
      height: 100,
      order: 0,
      isActive: false,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  );
  orderState.revision = 3;

  const res = await GET();
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.error, false);
  assert.equal(json.data.items.length, 2);
  assert.equal(json.data.items[0].id, "a");
  assert.equal(json.data.items[1].id, "b");
  assert.equal(json.data.revision, 3);
});

test("GET fails closed when the singleton state is missing", async () => {
  stateFindUniqueMock.mock.mockImplementationOnce(async () => null);

  const res = await GET();

  assert.equal(res.status, 500);
  const json = await res.json();
  assert.equal(json.error, true);
  assert.notEqual(json.data?.revision, 0);
});

test("POST creates inactive item, appends order, uses lock, and increments revision", async () => {
  const formData = new FormData();
  formData.append("altText", "Banner Baru");
  formData.append(
    "file",
    new File(["dummy"], "banner.png", { type: "image/png" }),
  );

  const req = new NextRequest(
    "http://localhost/api/admin/important-information",
    {
      method: "POST",
      body: formData,
    },
  );

  const res = await POST(req);
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.error, false);
  assert.equal(json.data.altText, "Banner Baru");
  assert.equal(json.data.isActive, false);
  assert.equal(json.data.order, 0);
  assert.equal(orderState.revision, 1);
  assert.equal(advisoryKeys[0], "important-information:global-order");
});

test("POST appends below the greatest existing order", async () => {
  items.push({
    id: "existing",
    imageUrl: "/uploads/existing.png",
    altText: "Existing",
    width: 400,
    height: 200,
    order: 4,
    isActive: true,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  });
  const formData = new FormData();
  formData.append("altText", "Banner Baru");
  formData.append("file", new File(["dummy"], "banner.png", { type: "image/png" }));

  const res = await POST(
    new NextRequest("http://localhost/api/admin/important-information", {
      method: "POST",
      body: formData,
    }),
  );

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.data.order, 5);
});

test("POST rejects malformed multipart input with a client error", async () => {
  const res = await POST(
    new Request("http://localhost/api/admin/important-information", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=invalid" },
      body: "not multipart",
    }),
  );

  assert.equal(res.status, 400);
});

test("POST rolls back stored file when transaction fails", async () => {
  transactionMock.mock.mockImplementationOnce(async () => {
    throw new Error("DB error");
  });

  const formData = new FormData();
  formData.append("altText", "Banner Gagal");
  formData.append(
    "file",
    new File(["dummy"], "banner.png", { type: "image/png" }),
  );

  const req = new NextRequest(
    "http://localhost/api/admin/important-information",
    {
      method: "POST",
      body: formData,
    },
  );

  const res = await POST(req);
  assert.equal(res.status, 500);
  assert.equal(rollbackMock.mock.calls.length, 1);
});
