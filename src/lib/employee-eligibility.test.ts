import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEmploymentActive,
  isPicEligible,
  type EmployeeEligibilityInput,
} from "./employee-eligibility";

function employee(
  overrides: Partial<EmployeeEligibilityInput> = {},
): EmployeeEligibilityInput {
  return {
    jenjang: "4",
    kodeStatpeg: "01",
    statKepeg: "02",
    isPresentInSource: true,
    ...overrides,
  };
}

describe("employee eligibility", () => {
  it("derives employment activity only from the two HR status fields", () => {
    assert.equal(isEmploymentActive(employee()), true);
    assert.equal(isEmploymentActive(employee({ kodeStatpeg: "02" })), false);
    assert.equal(isEmploymentActive(employee({ statKepeg: "01" })), false);
    assert.equal(
      isEmploymentActive(employee({ kodeStatpeg: "02", statKepeg: "01" })),
      false,
    );
  });

  it("accepts only present employees at jenjang 4 or 5 with active HR status", () => {
    assert.equal(isPicEligible(employee({ jenjang: "4" })), true);
    assert.equal(isPicEligible(employee({ jenjang: "5" })), true);
    assert.equal(isPicEligible(employee({ jenjang: "3" })), false);
    assert.equal(isPicEligible(employee({ isPresentInSource: false })), false);
    assert.equal(isPicEligible(employee({ kodeStatpeg: "02" })), false);
    assert.equal(isPicEligible(employee({ statKepeg: "01" })), false);
  });

  it("keeps employment activity independent from source presence and jenjang", () => {
    assert.equal(
      isEmploymentActive(employee({ jenjang: "3", isPresentInSource: false })),
      true,
    );
  });
});
