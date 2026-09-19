import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EmployeeAccount } from "@/types/user.types";
import { summarizeEmployeeUi } from "./employee-management-ui";

function user(
  overrides: Partial<NonNullable<EmployeeAccount["user"]>> = {},
): NonNullable<EmployeeAccount["user"]> {
  return {
    id: "user-1",
    name: "User",
    username: "user-1",
    role: "VIEWER",
    authProvider: "SSO",
    unitId: "unit-1",
    unit: null,
    isActive: true,
    ...overrides,
  };
}

function employee(overrides: Partial<EmployeeAccount> = {}): EmployeeAccount {
  return {
    id: "employee-1",
    nip: "nip-1",
    name: "Employee",
    jenjang: "4",
    kodeStatpeg: "01",
    statKepeg: "02",
    unitId: "unit-1",
    unit: null,
    isPresentInSource: true,
    employmentActive: true,
    picEligible: true,
    user: user(),
    ...overrides,
  };
}

describe("summarizeEmployeeUi", () => {
  it("returns no flags when employee and user unit IDs are equal", () => {
    const result = summarizeEmployeeUi(
      employee({ unitId: "unit-1", user: user({ unitId: "unit-1" }) }),
    );

    assert.deepEqual(result, {
      flags: [],
      hasReviewFlag: false,
      unitScopeMismatch: false,
    });
  });

  it("returns all combined flags in stable order", () => {
    assert.deepEqual(
      summarizeEmployeeUi(
        employee({
          isPresentInSource: false,
          employmentActive: false,
          user: user({ isActive: false, unitId: "unit-2" }),
        }),
      ),
      {
        flags: [
          "SOURCE_ABSENT",
          "EMPLOYMENT_INACTIVE",
          "ACCOUNT_INACTIVE",
          "UNIT_SCOPE_MISMATCH",
        ],
        hasReviewFlag: true,
        unitScopeMismatch: true,
      },
    );
  });

  it("reports source absence with an unlinked account", () => {
    assert.deepEqual(
      summarizeEmployeeUi(
        employee({
          isPresentInSource: false,
          user: null,
        }),
      ),
      {
        flags: ["SOURCE_ABSENT", "ACCOUNT_UNLINKED"],
        hasReviewFlag: true,
        unitScopeMismatch: false,
      },
    );
  });

  it("reports employment inactivity with an unlinked account", () => {
    assert.deepEqual(
      summarizeEmployeeUi(
        employee({
          employmentActive: false,
          user: null,
        }),
      ),
      {
        flags: ["EMPLOYMENT_INACTIVE", "ACCOUNT_UNLINKED"],
        hasReviewFlag: true,
        unitScopeMismatch: false,
      },
    );
  });

  it("uses authoritative employmentActive when employment codes disagree", () => {
    assert.deepEqual(
      summarizeEmployeeUi(
        employee({
          kodeStatpeg: "01",
          statKepeg: "02",
          employmentActive: false,
        }),
      ).flags,
      ["EMPLOYMENT_INACTIVE"],
    );

    assert.deepEqual(
      summarizeEmployeeUi(
        employee({
          kodeStatpeg: "99",
          statKepeg: "99",
          employmentActive: true,
        }),
      ).flags,
      [],
    );
  });

  it("does not let picEligible affect the summary", () => {
    const eligible = summarizeEmployeeUi(employee({ picEligible: true }));
    const ineligible = summarizeEmployeeUi(employee({ picEligible: false }));

    assert.deepEqual(ineligible, eligible);
  });

  it("reports an inactive linked account", () => {
    assert.deepEqual(
      summarizeEmployeeUi(
        employee({
          user: user({ isActive: false }),
        }),
      ),
      {
        flags: ["ACCOUNT_INACTIVE"],
        hasReviewFlag: true,
        unitScopeMismatch: false,
      },
    );
  });

  it("reports a mismatch only when both unit IDs are non-null and unequal", () => {
    assert.equal(
      summarizeEmployeeUi(
        employee({
          user: user({ unitId: "unit-2" }),
        }),
      ).unitScopeMismatch,
      true,
    );

    assert.equal(
      summarizeEmployeeUi(
        employee({
          unitId: null,
          user: user({ unitId: "unit-2" }),
        }),
      ).unitScopeMismatch,
      false,
    );

    assert.equal(
      summarizeEmployeeUi(
        employee({
          user: user({ unitId: null }),
        }),
      ).unitScopeMismatch,
      false,
    );
  });
});
