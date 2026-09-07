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

mock.module("@/auth", {
  namedExports: { auth: authMock },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      picImportantInformation: {
        findUnique: mock.fn(
          async ({ where }: { where: { id: string } }) =>
            items.find((i) => i.id === where.id) ?? null,
        ),
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
    },
  },
});

let PATCH: (
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => Promise<Response>;

const validId = "123e4567-e89b-12d3-a456-426614174000";

before(async () => {
  const route = await import("./route");
  PATCH = route.PATCH;
});

beforeEach(() => {
  authMock.mock.mockImplementation(async () => ({
    user: { id: "admin-1", role: "ADMIN" },
  }));
  items.length = 0;

  items.push({
    id: validId,
    imageUrl: "/uploads/important-information/banner.png",
    altText: "Banner",
    width: 300,
    height: 150,
    order: 0,
    isActive: false,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
  });
});

test("PATCH status returns 401 for unauth and 403 for non-admin", async () => {
  authMock.mock.mockImplementationOnce(async () => null);
  const unauth = await PATCH(new Request("http://localhost"), {
    params: Promise.resolve({ id: validId }),
  });
  assert.equal(unauth.status, 401);

  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", role: "PIC" },
  }));
  const forbidden = await PATCH(new Request("http://localhost"), {
    params: Promise.resolve({ id: validId }),
  });
  assert.equal(forbidden.status, 403);
});

test("PATCH status validates UUID and body format", async () => {
  const badUuid = await PATCH(new Request("http://localhost"), {
    params: Promise.resolve({ id: "invalid-uuid" }),
  });
  assert.equal(badUuid.status, 400);

  const req = new NextRequest("http://localhost", {
    method: "PATCH",
    body: JSON.stringify({ isActive: "true" }), // string is invalid, must be boolean
  });

  const badBody = await PATCH(req, {
    params: Promise.resolve({ id: validId }),
  });
  assert.equal(badBody.status, 400);

  const malformed = await PATCH(
    new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
    { params: Promise.resolve({ id: validId }) },
  );
  assert.equal(malformed.status, 400);
});

test("PATCH status successfully activates item and allows multiple active items", async () => {
  const req = new NextRequest("http://localhost", {
    method: "PATCH",
    body: JSON.stringify({ isActive: true }),
  });

  const res = await PATCH(req, {
    params: Promise.resolve({ id: validId }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.isActive, true);
  assert.equal(items[0].isActive, true);
});

test("PATCH status changes only the requested item and does not touch order state", async () => {
  const otherId = "123e4567-e89b-12d3-a456-426614174001";
  items.push({ ...items[0], id: otherId, isActive: true, order: 1 });
  const req = new NextRequest("http://localhost", {
    method: "PATCH",
    body: JSON.stringify({ isActive: false }),
  });

  const res = await PATCH(req, { params: Promise.resolve({ id: validId }) });
  assert.equal(res.status, 200);
  assert.equal(items[0].isActive, false);
  assert.equal(items[1].isActive, true);
});
