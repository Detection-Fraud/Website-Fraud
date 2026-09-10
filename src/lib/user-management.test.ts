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

  it("searchActivePics returns only linked, eligible, unit-consistent SSO PICs", async () => {
    const records = [
      {
        ...employee(),
        id: "user-1",
        role: "PIC",
        authProvider: "SSO",
        isActive: true,
        employee: employee(),
      },
      {
        ...employee({ jenjang: "3" }),
        id: "user-2",
        role: "PIC",
        authProvider: "SSO",
        isActive: true,
        employee: employee({ jenjang: "3" }),
      },
      {
        ...employee({ unitId: "other-unit" }),
        id: "user-3",
        role: "PIC",
        authProvider: "SSO",
        isActive: true,
        unitId: "unit-1",
        employee: employee({ unitId: "other-unit" }),
      },
    ];
    let receivedArgs: any;
    const db = {
      user: {
        findMany: async (args: any) => {
          receivedArgs = args;
          return records;
        },
      },
    };

    const result = await management.searchActivePics(
      { query: "user", unitId: "unit-1" },
      db as never,
    );

    assert.deepEqual(
      result.map((item) => item.id),
      ["user-1"],
    );
    assert.deepEqual(receivedArgs.where.employee.is, {
      jenjang: { in: ["4", "5"] },
      kodeStatpeg: "01",
      statKepeg: "02",
      isPresentInSource: true,
      unitId: "unit-1",
    });
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

  it("creates an inactive SSO ADMIN when ENSURE_ADMIN finds no identity", async () => {
    const created = {
      id: "admin-1",
      role: "ADMIN",
      authProvider: "SSO",
      isActive: false,
    };
    const tx = {
      employee: { findUnique: async () => employee() },
      user: {
        findMany: async () => [],
        create: async () => created,
      },
    };

    const result = await management.applyEmployeeAdminAction(
      "employee-1",
      "actor-1",
      { action: "ENSURE_ADMIN" },
      {
        $transaction: async (callback: (value: typeof tx) => unknown) =>
          callback(tx),
      } as never,
    );

    assert.deepEqual(result, created);
  });

  it("deduplicates matching username and samlNameId for ENSURE_ADMIN", async () => {
    const existing = {
      id: "admin-1",
      name: "Old",
      username: "12345",
      samlNameId: "12345",
      role: "VIEWER",
      authProvider: "SSO",
      unitId: "assigned-unit",
      isActive: true,
      employeeId: null,
    };
    let updateArgs: any;
    const tx = {
      employee: { findUnique: async () => employee() },
      user: {
        findMany: async () => [existing, existing],
        update: async (args: any) => {
          updateArgs = args;
          return { ...existing, role: "ADMIN", isActive: false };
        },
      },
    };

    await management.applyEmployeeAdminAction(
      "employee-1",
      "actor-1",
      { action: "ENSURE_ADMIN" },
      { $transaction: async (callback: any) => callback(tx) } as never,
    );

    assert.equal(updateArgs.where.id, "admin-1");
    assert.equal(updateArgs.data.role, "ADMIN");
    assert.equal(updateArgs.data.isActive, false);
    assert.equal(updateArgs.data.unitId, undefined);
  });

  it("preserves active state for an existing SSO ADMIN", async () => {
    const linked = {
      id: "admin-1",
      name: "Admin",
      username: "12345",
      samlNameId: "12345",
      role: "ADMIN",
      authProvider: "SSO",
      unitId: "assigned-unit",
      isActive: true,
      employeeId: "employee-1",
    };
    const tx = {
      employee: { findUnique: async () => ({ ...employee(), user: linked }) },
      user: {
        update: async (args: any) => ({ ...linked, ...args.data }),
      },
    };

    const result = await management.applyEmployeeAdminAction(
      "employee-1",
      "actor-1",
      { action: "ENSURE_ADMIN" },
      { $transaction: async (callback: any) => callback(tx) } as never,
    );

    assert.equal(result.isActive, true);
    assert.equal(result.unitId, "assigned-unit");
  });

  it("activates an SSO ADMIN using employment/source state, not PIC eligibility", async () => {
    const linked = {
      id: "admin-1",
      name: "Admin",
      username: "12345",
      samlNameId: "12345",
      role: "ADMIN",
      authProvider: "SSO",
      unitId: null,
      isActive: false,
      employeeId: "employee-1",
    };
    let updateArgs: any;
    const tx = {
      employee: {
        findUnique: async () => ({
          ...employee({ jenjang: "1", user: linked }),
        }),
      },
      user: {
        update: async (args: any) => {
          updateArgs = args;
          return { ...linked, ...args.data };
        },
      },
    };

    await management.applyEmployeeAdminAction(
      "employee-1",
      "actor-1",
      { action: "SET_ACTIVE", isActive: true },
      { $transaction: async (callback: any) => callback(tx) } as never,
    );

    assert.equal(updateArgs.data.isActive, true);
  });

  it("rejects activation when the Employee is absent from source", async () => {
    const tx = {
      employee: {
        findUnique: async () => ({
          ...employee({
            isPresentInSource: false,
            user: { id: "admin-1", role: "ADMIN", authProvider: "SSO" },
          }),
        }),
      },
      user: {
        update: async () => {
          throw new Error("must not update");
        },
      },
    };

    await assert.rejects(
      () =>
        management.applyEmployeeAdminAction(
          "employee-1",
          "actor-1",
          { action: "SET_ACTIVE", isActive: true },
          { $transaction: async (callback: any) => callback(tx) } as never,
        ),
      /source terbaru/,
    );
  });

  it("revokes to inactive VIEWER, preserves link/unit, and rejects self-revoke", async () => {
    const linked = {
      id: "admin-1",
      role: "ADMIN",
      authProvider: "SSO",
      unitId: "assigned-unit",
      isActive: true,
      employeeId: "employee-1",
    };
    let updateArgs: any;
    const tx = {
      employee: { findUnique: async () => ({ ...employee(), user: linked }) },
      user: {
        update: async (args: any) => {
          updateArgs = args;
          return { ...linked, ...args.data };
        },
      },
    };

    const result = await management.applyEmployeeAdminAction(
      "employee-1",
      "actor-1",
      { action: "REVOKE_ADMIN" },
      { $transaction: async (callback: any) => callback(tx) } as never,
    );

    assert.deepEqual(updateArgs.data, { role: "VIEWER", isActive: false });
    assert.equal(result.employeeId, "employee-1");
    assert.equal(result.unitId, "assigned-unit");

    await assert.rejects(
      () =>
        management.applyEmployeeAdminAction(
          "employee-1",
          "admin-1",
          { action: "REVOKE_ADMIN" },
          { $transaction: async (callback: any) => callback(tx) } as never,
        ),
      /dirinya sendiri/,
    );
  });

  it("rechecks demotion state inside a serializable transaction", async () => {
    let transactionOptions: any;
    let updateArgs: any;
    const tx = {
      user: {
        findUnique: async () => ({
          id: "pic-1",
          role: "PIC",
          authProvider: "SSO",
        }),
        update: async (args: any) => {
          updateArgs = args;
          return { id: "pic-1", role: "VIEWER", isActive: false };
        },
      },
    };
    const db = {
      $transaction: async (callback: any, options: any) => {
        transactionOptions = options;
        return callback(tx);
      },
    };

    await management.demoteUser("pic-1", db as never);

    assert.equal(transactionOptions.isolationLevel, "Serializable");
    assert.deepEqual(updateArgs.data, { role: "VIEWER", isActive: false });
  });

it("excludes linked LOCAL/debug Users while retaining SSO-linked and unlinked Employees", async () => {
  let receivedWhere: any;
  const db = {
    employee: {
      findMany: async (args: any) => {
        receivedWhere = args.where;
        return [
          employee({ id: "employee-unlinked", user: null }),
          employee({
            id: "employee-sso",
            user: {
              id: "sso-user",
              name: "SSO User",
              username: "12346",
              role: "VIEWER",
              authProvider: "SSO",
              unitId: "unit-1",
              isActive: true,
              createdAt: new Date(),
              unit: null,
            },
          }),
        ];
      },
      count: async () => 2,
    },
  };

  const result = await management.listEmployeesForManagement(
    { page: 1, limit: 10 },
    db as never,
  );

  assert.deepEqual(receivedWhere.OR, [
    { user: { is: null } },
    { user: { is: { authProvider: "SSO" } } },
  ]);
  assert.deepEqual(
    result.employees.map((item) => item.id),
    ["employee-unlinked", "employee-sso"],
  );
});

it("applies SSO-only relation filtering to linked Employee results", async () => {
  let receivedWhere: any;
  const db = {
    employee: {
      findMany: async (args: any) => {
        receivedWhere = args.where;
        return [];
      },
      count: async () => 0,
    },
  };

  await management.listEmployeesForManagement(
    { account: "LINKED", page: 1, limit: 10 },
    db as never,
  );

  assert.deepEqual(receivedWhere.user, {
    is: { authProvider: "SSO" },
  });
});
});
