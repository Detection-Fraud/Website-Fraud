import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";

type MockItem = {
  id: string;
  imageUrl: string;
  altText: string;
  width: number;
  height: number;
  order: number;
  isActive: boolean;
  createdAt: Date;
};

const authMock = mock.fn<
  () => Promise<{
    user: { id: string; role: string; authProvider: "LOCAL" };
  } | null>
>(async () => ({
  user: { id: "pic-1", role: "PIC", authProvider: "LOCAL" },
}));

type AuthUserRow = {
  id: string;
  name: string;
  username: string;
  role: string;
  authProvider: "LOCAL";
  isActive: boolean;
  unitId: string | null;
  unit: null;
  employee: null;
};

const authUsers: Record<string, AuthUserRow> = {
  "admin-1": {
    id: "admin-1", name: "Admin", username: "admin", role: "ADMIN",
    authProvider: "LOCAL", isActive: true, unitId: null, unit: null, employee: null,
  },
  "pic-1": {
    id: "pic-1", name: "PIC", username: "pic", role: "PIC",
    authProvider: "LOCAL", isActive: true, unitId: "pic-unit", unit: null, employee: null,
  },
  "viewer-1": {
    id: "viewer-1", name: "Viewer", username: "viewer", role: "VIEWER",
    authProvider: "LOCAL", isActive: true, unitId: null, unit: null, employee: null,
  },
};

const authUserFindUniqueMock = mock.fn(
  async ({ where }: { where: { id: string } }) => authUsers[where.id] ?? null,
);

const items: MockItem[] = [];

mock.module("@/auth", {
  namedExports: { auth: authMock },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: { findUnique: authUserFindUniqueMock },
      picImportantInformation: {
        findMany: mock.fn(
          async ({
            where,
            orderBy,
          }: {
            where?: { isActive?: boolean };
            orderBy?: { [key: string]: "asc" | "desc" }[];
          }) => {
            let filtered = items.filter(
              (i) =>
                where?.isActive === undefined || i.isActive === where.isActive,
            );
            if (orderBy) {
              filtered = [...filtered].sort(
                (a, b) =>
                  a.order - b.order ||
                  a.createdAt.getTime() - b.createdAt.getTime() ||
                  a.id.localeCompare(b.id),
              );
            }
            return filtered.map(
              ({ id, imageUrl, altText, width, height, order }) => ({
                id,
                imageUrl,
                altText,
                width,
                height,
                order,
              }),
            );
          },
        ),
      },
    },
  },
});

let GET: () => Promise<Response>;

before(async () => {
  const route = await import("./route");
  GET = route.GET;
});

beforeEach(() => {
  authMock.mock.mockImplementation(async () => ({
    user: { id: "pic-1", role: "PIC", authProvider: "LOCAL" },
  }));
  items.length = 0;
});

test("GET returns 401 for unauth and 403 for non-PIC", async () => {
  authMock.mock.mockImplementationOnce(async () => null);
  const unauth = await GET();
  assert.equal(unauth.status, 401);

  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "admin-1", role: "ADMIN", authProvider: "LOCAL" },
  }));
  const adminForbidden = await GET();
  assert.equal(adminForbidden.status, 403);

  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "viewer-1", role: "VIEWER", authProvider: "LOCAL" },
  }));
  const viewerForbidden = await GET();
  assert.equal(viewerForbidden.status, 403);
});

test("GET returns empty array when no active items", async () => {
  items.push({
    id: "item-inactive",
    imageUrl: "/uploads/inactive.png",
    altText: "Inactive Banner",
    width: 400,
    height: 200,
    order: 0,
    isActive: false,
    createdAt: new Date(),
  });

  const res = await GET();
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.error, false);
  assert.deepEqual(json.data.items, []);
});

test("GET returns only active items sorted deterministically with 6 public fields", async () => {
  items.push(
    {
      id: "b",
      imageUrl: "/uploads/b.png",
      altText: "B",
      width: 400,
      height: 200,
      order: 1,
      isActive: true,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
    },
    {
      id: "a",
      imageUrl: "/uploads/a.png",
      altText: "A",
      width: 400,
      height: 200,
      order: 0,
      isActive: true,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
    },
    {
      id: "c-inactive",
      imageUrl: "/uploads/c.png",
      altText: "C",
      width: 400,
      height: 200,
      order: 0,
      isActive: false,
      createdAt: new Date("2026-09-01T09:00:00.000Z"),
    },
  );

  const res = await GET();
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.error, false);
  assert.equal(json.data.items.length, 2);
  assert.equal(json.data.items[0].id, "a");
  assert.equal(json.data.items[1].id, "b");

  const keys = Object.keys(json.data.items[0]).sort();
  assert.deepEqual(keys, [
    "altText",
    "height",
    "id",
    "imageUrl",
    "order",
    "width",
  ]);
});
