import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { parseEmployeeSnapshot } from "./employee-sync-contract";
import type { ExistingEmployeeForSync } from "./employee-sync";

const failedRunCreateMock = mock.fn<(...args: any[]) => Promise<unknown>>(
  async () => ({ id: "failed-run-1" }),
);
const failedRunUpdateMock = mock.fn<(...args: any[]) => Promise<unknown>>(
  async () => ({ id: "failed-run-1" }),
);
const transactionMock = mock.fn<(...args: any[]) => unknown>();

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      employeeSyncRun: {
        create: failedRunCreateMock,
        update: failedRunUpdateMock,
      },
      $transaction: transactionMock,
    },
  },
});

let shouldDeactivateLinkedPicUser: typeof import("./employee-sync").shouldDeactivateLinkedPicUser;
let syncEmployeeSnapshot: typeof import("./employee-sync").syncEmployeeSnapshot;

before(async () => {
  const employeeSync = await import("./employee-sync");
  shouldDeactivateLinkedPicUser = employeeSync.shouldDeactivateLinkedPicUser;
  syncEmployeeSnapshot = employeeSync.syncEmployeeSnapshot;
});

beforeEach(() => {
  failedRunCreateMock.mock.resetCalls();
  failedRunUpdateMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
});

const existingPic: ExistingEmployeeForSync = {
  unitId: "unit-old",
  user: {
    id: "user-1",
    role: "PIC",
    isActive: true,
  },
};

describe("canonical employee snapshot contract", () => {
  it("accepts an empty employee snapshot", () => {
    const snapshot = parseEmployeeSnapshot({
      sourceSystem: "PENTAHO",
      employees: [],
    });

    assert.deepEqual(snapshot.employees, []);
  });

  it("rejects duplicate NIPs", () => {
    assert.throws(
      () =>
        parseEmployeeSnapshot({
          sourceSystem: "PENTAHO",
          employees: [
            {
              nip: "123",
              name: "Employee One",
              jenjang: "4",
              kodeStatpeg: "01",
              statKepeg: "02",
              externalUnitCode: "UNIT-1",
            },
            {
              nip: "123",
              name: "Employee Two",
              jenjang: "5",
              kodeStatpeg: "01",
              statKepeg: "02",
              externalUnitCode: "UNIT-2",
            },
          ],
        }),
      /NIP duplikat/,
    );
  });

  it("rejects non-JSON-compatible source metadata", () => {
    assert.throws(
      () =>
        parseEmployeeSnapshot({
          sourceSystem: "PENTAHO",
          sourceMetadata: { fetchedAt: new Date() },
          employees: [],
        }),
      /sourceMetadata harus berisi nilai JSON yang kompatibel/,
    );
  });
});

describe("employee sync reconciliation invariants", () => {
  it("records a sanitized failed run and skips reconciliation for malformed snapshots", async () => {
    await assert.rejects(
      () =>
        syncEmployeeSnapshot({
          sourceSystem: "PENTAHO",
          sourceMetadata: { fetchedAt: new Date() },
          employees: [],
        }),
    );

    assert.equal(transactionMock.mock.callCount(), 0);
    assert.deepEqual(failedRunCreateMock.mock.calls[0].arguments[0], {
      data: {
        sourceSystem: "PENTAHO",
        status: "FAILED",
        receivedCount: 0,
        processedCount: 0,
        missingCount: 0,
        errorMessage:
          "Employee snapshot validation failed: sourceMetadata.fetchedAt: sourceMetadata harus berisi nilai JSON yang kompatibel",
      },
      select: { id: true },
    });
  });

  it("records a failed duplicate snapshot without missing-marking Employees", async () => {
    await assert.rejects(
      () =>
        syncEmployeeSnapshot({
          sourceSystem: "PENTAHO",
          employees: [
            {
              nip: "123",
              name: "Employee One",
              jenjang: "4",
              kodeStatpeg: "01",
              statKepeg: "02",
              externalUnitCode: "UNIT-1",
            },
            {
              nip: "123",
              name: "Employee Two",
              jenjang: "5",
              kodeStatpeg: "01",
              statKepeg: "02",
              externalUnitCode: "UNIT-2",
            },
          ],
        }),
    );

    assert.equal(transactionMock.mock.callCount(), 0);
    assert.equal(failedRunCreateMock.mock.callCount(), 1);
    assert.equal(
      failedRunCreateMock.mock.calls[0].arguments[0].data.status,
      "FAILED",
    );
    assert.match(
      failedRunCreateMock.mock.calls[0].arguments[0].data.errorMessage,
      /employees\.1\.nip: NIP duplikat/,
    );
  });

  it("sanitizes unmapped external unit errors after transaction rollback", async () => {
    transactionMock.mock.mockImplementationOnce(async (callback: any) =>
      callback({
        unitExternalMapping: {
          findMany: async () => [],
        },
      }),
    );

    await assert.rejects(
      () =>
        syncEmployeeSnapshot({
          sourceSystem: "PENTAHO",
          employees: [
            {
              nip: "123",
              name: "Employee One",
              jenjang: "4",
              kodeStatpeg: "01",
              statKepeg: "02",
              externalUnitCode: "UNKNOWN\u0001UNIT",
            },
          ],
        }),
      /UnitExternalMapping tidak ditemukan/,
    );

    assert.equal(failedRunUpdateMock.mock.callCount(), 1);
    const errorMessage =
      failedRunUpdateMock.mock.calls[0].arguments[0].data.errorMessage;
    assert.equal(errorMessage.includes("\u0001"), false);
    assert.match(errorMessage, /UNKNOWN UNIT/);
  });

  it("deactivates an active PIC when the Employee changes unit", () => {
    assert.equal(
      shouldDeactivateLinkedPicUser(existingPic, {
        unitId: "unit-new",
        jenjang: "4",
        kodeStatpeg: "01",
        statKepeg: "02",
        isPresentInSource: true,
      }),
      true,
    );
  });

  it("does not deactivate a valid PIC when nothing relevant changes", () => {
    assert.equal(
      shouldDeactivateLinkedPicUser(existingPic, {
        unitId: "unit-old",
        jenjang: "4",
        kodeStatpeg: "01",
        statKepeg: "02",
        isPresentInSource: true,
      }),
      false,
    );
  });
});
