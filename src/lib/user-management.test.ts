import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";

mock.module("@/auth", {
  namedExports: {
    auth: mock.fn(async () => ({
      user: { id: "admin", role: "ADMIN" },
    })),
  },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {},
  },
});

let management: typeof import("./user-management");

before(async () => {
  management = await import("./user-management");
});

function employee(overrides: Record<string, unknown> = {}) {
  return {
    id: "employee-1",
    nip: "12345",
    name: "Eligible",
    jenjang: "4",
    kodeStatpeg: "01",
    statKepeg: "02",
    unitId: "unit-1",
    isPresentInSource: true,
    unit: {
      id: "unit-1",
      name: "Unit",
      type: "DIVISI",
    },
    user: null,
    ...overrides,
  };
}

describe("user management service", () => {
  it("searches Employees and applies only canonical PIC eligibility", async () => {
    const records = [
      employee(),
      employee({
        id: "employee-2",
        jenjang: "3",
      }),
      employee({
        id: "employee-3",
        user: {
          id: "viewer-1",
          name: "Viewer",
          username: "12346",
          role: "VIEWER",
          authProvider: "SSO",
          unitId: "unit-1",
          isActive: true,
          createdAt: new Date(),
          unit: null,
        },
      }),
      employee({
        id: "employee-4",
        name: "Moved PIC",
        nip: "12347",
        unitId: "new-unit",
        user: {
          id: "pic-1",
          name: "Moved PIC",
          username: "12347",
          role: "PIC",
          authProvider: "SSO",
          unitId: "old-unit",
          isActive: false,
          createdAt: new Date(),
          unit: null,
        },
      }),
    ];

    const db = {
      employee: {
        findMany: async (args: {
          where: {
            OR: Array<{
              name?: { contains: string };
              nip?: { contains: string };
            }>;
            unitId: string;
          };
        }) =>
          records.filter(
            (item) =>
              item.unitId === args.where.unitId &&
              args.where.OR.some((condition) => {
                const predicate = Object.values(condition)[0];

                return Boolean(
                  predicate?.contains &&
                  (item.name
                    .toLowerCase()
                    .includes(predicate.contains.toLowerCase()) ||
                    item.nip
                      .toLowerCase()
                      .includes(predicate.contains.toLowerCase())),
                );
              }),
          ),
      },
    };

    const result = await management.searchPicCandidates(
      {
        query: "eli",
        unitId: "unit-1",
      },
      db as never,
    );

    assert.deepEqual(
      result.map((item) => item.employeeId),
      ["employee-1", "employee-3"],
    );

    const movedResult = await management.searchPicCandidates(
      {
        query: "moved",
        unitId: "new-unit",
      },
      db as never,
    );

    assert.deepEqual(
      movedResult.map((item) => item.employeeId),
      ["employee-4"],
    );
  });

  it("creates exactly one linked PIC for an unlinked Employee", async () => {
    const created = {
      id: "user-1",
      name: "Eligible",
      username: "12345",
      role: "PIC",
      unitId: "unit-1",
      isActive: true,
      createdAt: new Date(),
      unit: null,
    };

    const tx = {
      employee: {
        findUnique: async () => employee(),
      },
      user: {
        findUnique: async () => null,
        create: async () => created,
      },
    };

    const db = {
      $transaction: async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
    };

    const result = await management.createOrLinkUser(
      {
        employeeId: "employee-1",
        unitId: "unit-1",
        role: "PIC",
      },
      db as never,
    );

    assert.equal(result.id, "user-1");
  });

  it("rejects reactivation after Employee unit movement", async () => {
    const tx = {
      user: {
        findUnique: async () => ({
          id: "user-1",
          role: "PIC",
          unitId: "old-unit",
          employee: {
            ...employee({ unitId: "new-unit" }),
            user: {
              id: "user-1",
              role: "PIC",
              isActive: false,
            },
          },
        }),
        update: async () => {
          throw new Error("must not update");
        },
      },
    };

    const db = {
      $transaction: async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
    };

    await assert.rejects(
      () => management.setUserStatus("user-1", true, db as never),
      /reaktivasi/,
    );
  });
});
