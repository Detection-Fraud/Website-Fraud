import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateAuthPolicy,
  type AuthPolicyEmployee,
  type AuthPolicyUser,
} from "./auth-policy";

function user(overrides: Partial<AuthPolicyUser> = {}): AuthPolicyUser {
  return {
    role: "ADMIN",
    authProvider: "SSO",
    isActive: true,
    unitId: null,
    ...overrides,
  };
}

function employee(
  overrides: Partial<AuthPolicyEmployee> = {},
): AuthPolicyEmployee {
  return {
    jenjang: "4",
    kodeStatpeg: "01",
    statKepeg: "02",
    isPresentInSource: true,
    unitId: "unit-1",
    ...overrides,
  };
}

describe("canonical auth policy", () => {
  it("accepts an active employee Admin through SSO without requiring PIC eligibility", () => {
    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "SSO",
        user: user({ role: "ADMIN" }),
        employee: employee({ jenjang: "3" }),
      }),
      { allowed: true },
    );
  });

  it("rejects an SSO Admin without an Employee, missing source presence, or active employment", () => {
    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "SSO",
        user: user({ role: "ADMIN" }),
      }),
      { allowed: false, reason: "employee_required" },
    );

    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "SSO",
        user: user({ role: "ADMIN" }),
        employee: employee({ isPresentInSource: false }),
      }),
      { allowed: false, reason: "employee_not_present_in_source" },
    );

    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "SSO",
        user: user({ role: "ADMIN" }),
        employee: employee({ kodeStatpeg: "02" }),
      }),
      { allowed: false, reason: "employment_inactive" },
    );
  });

  it("accepts an active eligible PIC through SSO only in the assigned Employee unit", () => {
    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "SSO",
        user: user({ role: "PIC", unitId: "unit-1" }),
        employee: employee(),
      }),
      { allowed: true },
    );

    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "SSO",
        user: user({ role: "PIC", unitId: "unit-2" }),
        employee: employee(),
      }),
      { allowed: false, reason: "unit_mismatch" },
    );
  });

  it("rejects an SSO PIC without the required User.unitId or current eligibility", () => {
    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "SSO",
        user: user({ role: "PIC", unitId: null }),
        employee: employee(),
      }),
      { allowed: false, reason: "user_unit_required" },
    );

    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "SSO",
        user: user({ role: "PIC", unitId: "unit-1" }),
        employee: employee({ jenjang: "3" }),
      }),
      { allowed: false, reason: "pic_ineligible" },
    );
  });

  it("accepts an active Admin LOCAL debug account without an Employee", () => {
    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "LOCAL",
        user: user({ authProvider: "LOCAL", role: "ADMIN" }),
      }),
      { allowed: true },
    );
  });

  it("accepts a scoped PIC LOCAL debug account without an Employee", () => {
    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "LOCAL",
        user: user({ authProvider: "LOCAL", role: "PIC", unitId: "unit-1" }),
      }),
      { allowed: true },
    );

    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "LOCAL",
        user: user({ authProvider: "LOCAL", role: "PIC", unitId: null }),
      }),
      { allowed: false, reason: "user_unit_required" },
    );
  });

  it("rejects VIEWER for both providers", () => {
    for (const provider of ["SSO", "LOCAL"] as const) {
      assert.deepEqual(
        evaluateAuthPolicy({
          provider,
          user: user({ authProvider: provider, role: "VIEWER" }),
        }),
        { allowed: false, reason: "unsupported_role" },
      );
    }
  });

  it("fails closed for inactive users and provider mismatch", () => {
    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "LOCAL",
        user: user({ authProvider: "LOCAL", isActive: false, role: "ADMIN" }),
      }),
      { allowed: false, reason: "inactive_user" },
    );

    assert.deepEqual(
      evaluateAuthPolicy({
        provider: "LOCAL",
        user: user({ authProvider: "SSO", role: "ADMIN" }),
      }),
      { allowed: false, reason: "provider_mismatch" },
    );
  });
});
