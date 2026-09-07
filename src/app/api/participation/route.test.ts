import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

const authMock = mock.fn<(...args: any[]) => Promise<any>>(async () => null);
let currentAuthRole: "ADMIN" | "PIC" | "VIEWER" = "ADMIN";
const userFindUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => ({
    id: "admin-1",
    name: "Admin Test",
    username: "admin-test",
    role: currentAuthRole,
    authProvider: "LOCAL",
    isActive: true,
    unitId: currentAuthRole === "PIC" ? "unit-1" : null,
    unit: null,
    employee: null,
  }),
);
const categoryFindUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => null,
);
const unitFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => [],
);
const unitFindUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => ({
    id: "11111111-1111-4111-8111-111111111111",
  }),
);
const participationFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => [],
);
const participationFindUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => null,
);
const participationCreateMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => ({
    id: "participation-new",
  }),
);
const participationUpdateMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => ({
    id: "participation-existing",
  }),
);
const participationCorrectionAuditCreateMock = mock.fn<
  (...args: any[]) => Promise<any>
>(async () => ({ id: "audit-1" }));
const participationQueryRawMock = mock.fn<
  (...args: any[]) => Promise<any>
>(async () => []);
const transactionMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (callback: (tx: any) => Promise<unknown>) =>
    callback({
      $queryRaw: participationQueryRawMock,
      unit: { findUnique: unitFindUniqueMock },
      participationData: {
        findUnique: participationFindUniqueMock,
        findMany: participationFindManyMock,
        create: participationCreateMock,
        update: participationUpdateMock,
        updateMany: participationUpdateMock,
      },
      participationCorrectionAudit: {
        create: participationCorrectionAuditCreateMock,
      },
    }),
);
const workbookLoadMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => undefined,
);
const workbook = {
  worksheets: [{ eachRow: mock.fn<(...args: any[]) => any>() }],
  xlsx: { load: workbookLoadMock },
};
const workbookConstructorMock = mock.fn(function () {
  return workbook;
});

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      programCategory: { findUnique: categoryFindUniqueMock },
      user: { findUnique: userFindUniqueMock },
      unit: { findMany: unitFindManyMock },
      participationData: { findMany: participationFindManyMock },
      $transaction: transactionMock,
    },
  },
});
mock.module("exceljs", {
  defaultExport: { Workbook: workbookConstructorMock },
  namedExports: {
    default: { Workbook: workbookConstructorMock },
    Workbook: workbookConstructorMock,
  },
});

let POST: (request: NextRequest) => Promise<Response>;
before(async () => {
  ({ POST } = await import("./route"));
});
beforeEach(() => {
  authMock.mock.resetCalls();
  userFindUniqueMock.mock.resetCalls();
  categoryFindUniqueMock.mock.resetCalls();
  unitFindManyMock.mock.resetCalls();
  unitFindUniqueMock.mock.resetCalls();
  participationFindManyMock.mock.resetCalls();
  participationFindUniqueMock.mock.resetCalls();
  participationCreateMock.mock.resetCalls();
  participationUpdateMock.mock.resetCalls();
  participationCorrectionAuditCreateMock.mock.resetCalls();
  participationQueryRawMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
  workbookLoadMock.mock.resetCalls();
  workbookConstructorMock.mock.resetCalls();
  workbook.worksheets[0].eachRow.mock.resetCalls();

  currentAuthRole = "ADMIN";
  authMock.mock.mockImplementation(async () => ({
    user: {
      id: "admin-1",
      name: "Admin Test",
      role: currentAuthRole,
      authProvider: "LOCAL",
    },
  }));
  categoryFindUniqueMock.mock.mockImplementation(async () => ({
    targetUnit: "PARTISIPASI_PERSEN",
    evidenceMode: "NONE",
    scoreInputMode: "EXCEL_IMPORT",
  }));
  unitFindManyMock.mock.mockImplementation(async () => [
    { id: "11111111-1111-4111-8111-111111111111", name: "Unit A" },
  ]);
  workbook.worksheets[0].eachRow.mock.mockImplementation(
    (callback: (row: any, rowNumber: number) => void) =>
      callback(
        {
          getCell: (column: number) =>
            column === 2
              ? { text: "Unit A", value: "Unit A" }
              : { text: "80", value: 80 },
        },
        4,
      ),
  );
});

function filter() {
  return {
    categoryId: "22222222-2222-4222-8222-222222222222",
    tw: "1",
    year: "2026",
  };
}
function previewRequest() {
  const body = new FormData();
  body.set("file", new File([], "data.xlsx"));
  body.set("categoryId", filter().categoryId);
  body.set("tw", "1");
  body.set("year", "2026");
  return new NextRequest("http://localhost/api/participation?action=preview", {
    method: "POST",
    body,
  });
}
function commitRequest(rows: unknown[]) {
  return new NextRequest("http://localhost/api/participation?action=commit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...filter(), rows }),
  });
}
async function body(response: Response) {
  return response.json() as Promise<{
    status: number;
    error: boolean;
    data: any;
    message: string;
  }>;
}
const validUnitId = "11111111-1111-4111-8111-111111111111";

describe("POST /api/participation", () => {
  it("Admin exact tuple preview berhasil dan memakai standard envelope", async () => {
    const result = await body(await POST(previewRequest()));
    assert.equal(result.status, 200);
    assert.equal(result.error, false);
    assert.equal(result.data.rows[0].percentage, 80);
  });
  for (const [role, status] of [
    ["PIC", 403],
    ["VIEWER", 403],
  ] as const) {
    it(`${role} ditolak sebelum kerja file`, async () => {
      authMock.mock.mockImplementationOnce(async () => {
        currentAuthRole = role;
        return {
          user: {
            id: "user-1",
            role,
            name: role,
            authProvider: "LOCAL",
          },
        };
      });
      const result = await body(await POST(previewRequest()));
      assert.equal(result.status, status);
      assert.equal(workbookLoadMock.mock.callCount(), 0);
      assert.equal(unitFindManyMock.mock.callCount(), 0);
      assert.equal(transactionMock.mock.callCount(), 0);
    });
  }
  it("unauthenticated menerima 401", async () => {
    authMock.mock.mockImplementationOnce(async () => null);
    const result = await body(await POST(previewRequest()));
    assert.equal(result.status, 401);
  });
  it("filter invalid menerima 400", async () => {
    const request = new NextRequest(
      "http://localhost/api/participation?action=preview",
      { method: "POST", body: new FormData() },
    );
    const result = await body(await POST(request));
    assert.equal(result.status, 400);
    assert.equal(categoryFindUniqueMock.mock.callCount(), 0);
  });
  it("direct-admin/unsupported capability berhenti sebelum arrayBuffer, workbook, unit, transaction", async () => {
    categoryFindUniqueMock.mock.mockImplementationOnce(async () => ({
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "PHOTO_WITHOUT_AI",
      scoreInputMode: "DIRECT_ADMIN",
    }));
    const result = await body(await POST(previewRequest()));
    assert.equal(result.status, 422);
    assert.equal(workbookLoadMock.mock.callCount(), 0);
    assert.equal(workbookConstructorMock.mock.callCount(), 0);
    assert.equal(unitFindManyMock.mock.callCount(), 0);
    assert.equal(transactionMock.mock.callCount(), 0);
  });
  it("preview menandai 0, 80, 100 dan seluruh input strict invalid sebagai error", async () => {
    const values = [
      0,
      80,
      100,
      "",
      "80.5",
      -1,
      101,
      "80abc",
      "80%",
      "1e2",
      Infinity,
      NaN,
    ];
    workbook.worksheets[0].eachRow.mock.mockImplementation((callback: any) =>
      values.forEach((value, index) =>
        callback(
          {
            getCell: (column: number) =>
              column === 2
                ? { text: `Unit ${index}`, value: `Unit ${index}` }
                : { text: String(value), value },
          },
          index + 4,
        ),
      ),
    );
    unitFindManyMock.mock.mockImplementationOnce(async () =>
      values.map((_, index) => ({
        id: `11111111-1111-4111-8111-11111111111${index}`,
        name: `Unit ${index}`,
      })),
    );
    const result = await body(await POST(previewRequest()));
    const rows = result.data.rows as Array<{
      percentage: number | null;
      status: string;
    }>;
    assert.deepEqual(
      rows.slice(0, 3).map((row) => row.percentage),
      [0, 80, 100],
    );
    assert.equal(
      rows.slice(3).every((row) => row.status === "error"),
      true,
    );
    assert.equal(transactionMock.mock.callCount(), 0);
  });
  for (const percentage of [
    "80",
    80.5,
    -1,
    101,
    "80abc",
    "80%",
    "1e2",
  ] as unknown[]) {
    it(`commit menolak nilai strict ${String(percentage)}`, async () => {
      const result = await body(
        await POST(
          commitRequest([
            { unitId: validUnitId, percentage, overwrite: false },
          ]),
        ),
      );
      assert.equal(result.status, 400);
      assert.equal(transactionMock.mock.callCount(), 0);
    });
  }

  it("payload percentage-only legacy ditolak sebelum database bekerja", async () => {
    const result = await body(
      await POST(
        commitRequest([
          {
            unitId: validUnitId,
            percentage: 80,
            overwrite: true,
          },
        ]),
      ),
    );

    assert.equal(result.status, 400);
    assert.equal(transactionMock.mock.callCount(), 0);
    assert.equal(participationCreateMock.mock.callCount(), 0);
    assert.equal(participationUpdateMock.mock.callCount(), 0);
  });

  it("overwrite tanpa alasan ditolak sebelum transaction", async () => {
    const result = await body(
      await POST(
        commitRequest([
          {
            unitId: validUnitId,
            participantCount: 80,
            overwrite: true,
            reason: "   ",
          },
        ]),
      ),
    );

    assert.equal(result.status, 400);
    assert.equal(transactionMock.mock.callCount(), 0);
  });

  it("koreksi tetap hanya dapat dilakukan oleh ADMIN", async () => {
    authMock.mock.mockImplementationOnce(async () => {
      currentAuthRole = "PIC";
      return {
        user: {
          id: "pic-1",
          name: "PIC",
          role: "PIC",
          authProvider: "LOCAL",
        },
      };
    });

    const result = await body(
      await POST(
        commitRequest([
          {
            unitId: validUnitId,
            participantCount: 80,
            overwrite: true,
            reason: "Koreksi oleh PIC",
          },
        ]),
      ),
    );

    assert.equal(result.status, 403);
    assert.equal(transactionMock.mock.callCount(), 0);
  });

  it("koreksi menolak unit duplikat", async () => {
    const result = await body(
      await POST(
        commitRequest([
          {
            unitId: validUnitId,
            participantCount: 80,
            overwrite: false,
          },
          {
            unitId: validUnitId,
            participantCount: 81,
            overwrite: true,
            reason: "Koreksi duplikat",
          },
        ]),
      ),
    );

    assert.equal(result.status, 400);
    assert.equal(transactionMock.mock.callCount(), 0);
  });

  it("action invalid menerima 400", async () => {
    const result = await body(
      await POST(
        new NextRequest("http://localhost/api/participation?action=nope", {
          method: "POST",
        }),
      ),
    );
    assert.equal(result.status, 400);
  });
});
