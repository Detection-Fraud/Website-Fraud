import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEmployeeManagementParams } from "./useEmployeeManagement";

describe("buildEmployeeManagementParams", () => {
  it("omits ALL filters and blank search from the request", () => {
    assert.deepEqual(
      buildEmployeeManagementParams({
        search: "   ",
        source: "ALL",
        employment: "ALL",
        account: "ALL",
        role: "ALL",
        page: 1,
        limit: 10,
      }),
      { page: 1, limit: 10 },
    );
  });

  it("keeps every active filter in the request", () => {
    assert.deepEqual(
      buildEmployeeManagementParams({
        search: " 128812002 ",
        source: "PRESENT",
        employment: "ACTIVE",
        account: "LINKED",
        role: "PIC",
        page: 2,
        limit: 10,
      }),
      {
        search: "128812002",
        source: "PRESENT",
        employment: "ACTIVE",
        account: "LINKED",
        role: "PIC",
        page: 2,
        limit: 10,
      },
    );
  });
});
