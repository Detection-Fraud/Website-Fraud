import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findConflictingEmployeeCandidates,
  planEmployeeLinks,
  type CandidateUser,
} from "./backfill-employee-links";

const user = (overrides: Partial<CandidateUser> = {}): CandidateUser => ({
  id: "user-1",
  name: "SSO User",
  username: "nip-1",
  samlNameId: "nip-2",
  authProvider: "SSO",
  employeeId: null,
  role: "PIC",
  ...overrides,
});

describe("employee link backfill conflict detection", () => {
  it("blocks one User whose distinct NIPs resolve to different Employees", () => {
    const conflicts = findConflictingEmployeeCandidates(
      [user()],
      new Map([
        ["nip-1", { id: "employee-1", nip: "nip-1" }],
        ["nip-2", { id: "employee-2", nip: "nip-2" }],
      ]),
    );

    assert.equal(conflicts.length, 1);
    assert.match(conflicts[0], /user-1/);
    assert.match(conflicts[0], /employee-1/);
    assert.match(conflicts[0], /employee-2/);
  });

  it("plans exactly one link for normalized duplicate identifiers", () => {
    const plan = planEmployeeLinks(
      [user({ samlNameId: " nip-1 " })],
      new Map([["nip-1", { id: "employee-1", nip: "nip-1" }]]),
    );

    assert.deepEqual(plan.conflicts, []);
    assert.deepEqual(plan.links, [
      { userId: "user-1", employeeId: "employee-1", nip: "nip-1" },
    ]);
  });
});
