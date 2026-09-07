import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEmployeeSnapshot } from "./employee-sync-contract";
import {
  shouldDeactivateLinkedPicUser,
  type ExistingEmployeeForSync,
} from "./employee-sync";

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
});

describe("employee sync reconciliation invariants", () => {
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
