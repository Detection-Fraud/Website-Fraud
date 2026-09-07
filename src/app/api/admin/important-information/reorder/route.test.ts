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

const items: ImportantInformationRecord[] = [];
let orderState = { id: "global", revision: 0, updatedAt: new Date() };
const advisoryKeys: string[] = [];
let failUpdateAt: number | null = null;
let failRevisionUpdate = false;
let transactionTail = Promise.resolve();
const transactionOptions: unknown[] = [];

const tx = {
  picImportantInformation: {
    findMany: mock.fn(async () => items.map((i) => ({ ...i }))),
    update: mock.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ImportantInformationRecord>;
      }) => {
        if (
          failUpdateAt !== null &&
          tx.picImportantInformation.update.mock.callCount() + 1 ===
            failUpdateAt
        )
          throw new Error("update failed");
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
      if (failRevisionUpdate) throw new Error("revision update failed");
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
  async (
    callback: (transaction: typeof tx) => Promise<unknown>,
    options?: unknown,
  ) => {
    transactionOptions.push(options);
    let release!: () => void;
    const previous = transactionTail;
    transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const itemSnapshot = items.map((item) => ({ ...item }));
    const stateSnapshot = { ...orderState };
    try {
      return await callback(tx);
    } catch (error) {
      items.splice(0, items.length, ...itemSnapshot);
      orderState = stateSnapshot;
      throw error;
    } finally {
      release();
    }
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
      $transaction: transactionMock,
    },
  },
});

let PUT: (req: Request) => Promise<Response>;

const id1 = "123e4567-e89b-12d3-a456-426614174001";
const id2 = "123e4567-e89b-12d3-a456-426614174002";

before(async () => {
  const route = await import("./route");
  PUT = route.PUT;
});

beforeEach(() => {
  authMock.mock.mockImplementation(async () => ({
    user: { id: "admin-1", role: "ADMIN" },
  }));
  items.length = 0;
  advisoryKeys.length = 0;
  failUpdateAt = null;
  failRevisionUpdate = false;
  transactionTail = Promise.resolve();
  transactionOptions.length = 0;
  authMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
  tx.picImportantInformation.findMany.mock.resetCalls();
  tx.picImportantInformation.update.mock.resetCalls();
  tx.picImportantInformationOrderState.findUnique.mock.resetCalls();
  tx.picImportantInformationOrderState.update.mock.resetCalls();
  tx.$queryRaw.mock.resetCalls();
  orderState = { id: "global", revision: 2, updatedAt: new Date() };
  transactionMock.mock.mockImplementation(async (cb, options) => {
    transactionOptions.push(options);
    let release!: () => void;
    const previous = transactionTail;
    transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const itemSnapshot = items.map((item) => ({ ...item }));
    const stateSnapshot = { ...orderState };
    try {
      return await cb(tx);
    } catch (error) {
      items.splice(0, items.length, ...itemSnapshot);
      orderState = stateSnapshot;
      throw error;
    } finally {
      release();
    }
  });

  items.push(
    {
      id: id1,
      imageUrl: "/uploads/important-information/1.png",
      altText: "Item 1",
      width: 400,
      height: 200,
      order: 0,
      isActive: true,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      updatedAt: new Date("2026-09-01T10:00:00.000Z"),
    },
    {
      id: id2,
      imageUrl: "/uploads/important-information/2.png",
      altText: "Item 2",
      width: 400,
      height: 200,
      order: 1,
      isActive: false,
      createdAt: new Date("2026-09-01T10:05:00.000Z"),
      updatedAt: new Date("2026-09-01T10:05:00.000Z"),
    },
  );
});

test("PUT returns 401 for unauth and 403 for non-admin", async () => {
  authMock.mock.mockImplementationOnce(async () => null);
  const unauth = await PUT(
    new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ids: [id2, id1], revision: 2 }),
    }),
  );
  assert.equal(unauth.status, 401);

  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", role: "PIC" },
  }));
  const forbidden = await PUT(
    new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ids: [id2, id1], revision: 2 }),
    }),
  );
  assert.equal(forbidden.status, 403);
});

test("PUT returns 400 for invalid body payload", async () => {
  const req = new NextRequest("http://localhost", {
    method: "PUT",
    body: JSON.stringify({ ids: [], revision: 2 }), // empty ids
  });
  const res = await PUT(req);
  assert.equal(res.status, 400);
});

test("PUT returns 400 for malformed JSON without opening a transaction", async () => {
  const req = new NextRequest("http://localhost", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: "{\"ids\":[",
  });

  const res = await PUT(req);

  assert.equal(res.status, 400);
  assert.equal(transactionMock.mock.callCount(), 0);
  assert.equal(tx.picImportantInformation.update.mock.callCount(), 0);
});

test("PUT successfully reorders, uses lock, and increments revision", async () => {
  const req = new NextRequest("http://localhost", {
    method: "PUT",
    body: JSON.stringify({ ids: [id2, id1], revision: 2 }),
  });

  const res = await PUT(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.error, false);
  assert.equal(json.data.revision, 3);
  assert.equal(json.data.items.length, 2);
  assert.equal(json.data.items[0].id, id2);
  assert.equal(json.data.items[0].order, 0);
  assert.equal(json.data.items[1].id, id1);
  assert.equal(json.data.items[1].order, 1);
  assert.equal(advisoryKeys[0], "important-information:global-order");
  assert.equal(
    (transactionOptions[0] as { isolationLevel: string }).isolationLevel,
    "Serializable",
  );
});

test("PUT returns 409 ORDER_CONFLICT when revision is stale", async () => {
  const req = new NextRequest("http://localhost", {
    method: "PUT",
    body: JSON.stringify({ ids: [id2, id1], revision: 1 }), // stale revision (expected 2)
  });

  const res = await PUT(req);
  assert.equal(res.status, 409);
  const json = await res.json();
  assert.equal(json.error, true);
  assert.equal(json.errors?.code, "ORDER_CONFLICT");
  assert.equal(json.errors?.currentRevision, 2);
});

test("PUT returns 409 ORDER_CONFLICT when ids don't match current set", async () => {
  const unknownId = "123e4567-e89b-12d3-a456-426614174099";
  const req = new NextRequest("http://localhost", {
    method: "PUT",
    body: JSON.stringify({ ids: [id1, unknownId], revision: 2 }),
  });

  const res = await PUT(req);
  assert.equal(res.status, 409);
  const json = await res.json();
  assert.equal(json.errors?.code, "ORDER_CONFLICT");
  assert.equal(tx.picImportantInformation.update.mock.callCount(), 0);
});

for (const [label, ids] of [
  ["duplicate", [id1, id1]],
  ["missing", [id1]],
  ["partial", [id2]],
] as const) {
  test(`PUT rejects ${label} IDs without writes`, async () => {
    const res = await PUT(
      new NextRequest("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ ids, revision: 2 }),
      }),
    );
    const json = await res.json();

    assert.equal(res.status, 409);
    assert.equal(json.errors.code, "ORDER_CONFLICT");
    assert.equal(json.errors.currentRevision, 2);
    assert.equal(tx.picImportantInformation.update.mock.callCount(), 0);
    assert.equal(orderState.revision, 2);
  });
}

test("PUT rolls back all order writes when an update fails", async () => {
  failUpdateAt = 2;
  const before = items.map((item) => item.order);
  const res = await PUT(
    new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ids: [id2, id1], revision: 2 }),
    }),
  );

  assert.equal(res.status, 500);
  assert.deepEqual(items.map((item) => item.order), before);
  assert.equal(orderState.revision, 2);
});

test("PUT rolls back order writes when revision update fails", async () => {
  failRevisionUpdate = true;
  const before = items.map((item) => item.order);
  const res = await PUT(
    new NextRequest("http://localhost", {
      method: "PUT",
      body: JSON.stringify({ ids: [id2, id1], revision: 2 }),
    }),
  );

  assert.equal(res.status, 500);
  assert.deepEqual(items.map((item) => item.order), before);
  assert.equal(orderState.revision, 2);
});

test("concurrent writers serialize and leave one stale conflict", async () => {
  const responses = await Promise.all([
    PUT(
      new NextRequest("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ ids: [id2, id1], revision: 2 }),
      }),
    ),
    PUT(
      new NextRequest("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ ids: [id1, id2], revision: 2 }),
      }),
    ),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
  const conflict = await responses
    .find((response) => response.status === 409)!
    .json();
  assert.equal(conflict.errors.code, "ORDER_CONFLICT");
  assert.equal(orderState.revision, 3);
  assert.deepEqual(items.map((item) => item.order).sort(), [0, 1]);
});
