import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getEmployeeAdminAction,
  getEmployeeAdminActions,
  getEmployeePicManagementLink,
  getEmployeeManagementDeepLinkWarning,
  parseEmployeeManagementDeepLink,
} from "./employee-management-actions";

const baseEmployee = {
  id: "employee-1",
  nip: "12345",
  name: "Employee",
  jenjang: "4",
  kodeStatpeg: "01",
  statKepeg: "02",
  unitId: "hr-unit",
  unit: null,
  isPresentInSource: true,
  employmentActive: true,
  picEligible: true,
};

describe("employee management action helpers", () => {
  it("limits Employee-page actions to the SSO ADMIN lifecycle", () => {
    assert.equal(getEmployeeAdminAction({ ...baseEmployee, user: null }), "ENSURE_ADMIN");
    assert.equal(
      getEmployeeAdminAction({
        ...baseEmployee,
        user: {
          id: "user-1",
          name: "Employee",
          username: "12345",
          role: "ADMIN",
          authProvider: "SSO",
          unitId: null,
          unit: null,
          isActive: true,
        },
      }),
      "DEACTIVATE",
    );
    assert.equal(
      getEmployeeAdminAction({
        ...baseEmployee,
        user: {
          id: "user-1",
          name: "Employee",
          username: "12345",
          role: "PIC",
          authProvider: "SSO",
          unitId: "pic-unit",
          unit: null,
          isActive: true,
        },
      }),
      null,
    );
    assert.equal(
      getEmployeeAdminAction({
        ...baseEmployee,
        user: {
          id: "unknown-1",
          name: "Employee",
          username: "12345",
          role: "UNKNOWN" as never,
          authProvider: "SSO",
          unitId: null,
          unit: null,
          isActive: true,
        },
      }),
      null,
    );
    assert.equal(
      getEmployeeAdminAction({
        ...baseEmployee,
        user: {
          id: "local-1",
          name: "Employee",
          username: "12345",
          role: "ADMIN",
          authProvider: "LOCAL",
          unitId: null,
          unit: null,
          isActive: true,
        },
      }),
      null,
    );
    assert.equal(
      getEmployeeAdminAction({
        ...baseEmployee,
        user: {
          id: "viewer-1",
          name: "Employee",
          username: "12345",
          role: "VIEWER",
          authProvider: "SSO",
          unitId: null,
          unit: null,
          isActive: true,
        },
      }),
      "PROMOTE_VIEWER",
    );
    assert.deepEqual(
      getEmployeeAdminActions({
        ...baseEmployee,
        user: {
          id: "admin-1",
          name: "Employee",
          username: "12345",
          role: "ADMIN",
          authProvider: "SSO",
          unitId: null,
          unit: null,
          isActive: true,
        },
      }),
      ["DEACTIVATE", "REVOKE_ADMIN"],
    );
  });

  it("builds a read-only PIC deep link from User.unitId", () => {
    const link = getEmployeePicManagementLink({
      ...baseEmployee,
      user: {
        id: "user-1",
        name: "Employee",
        username: "12345",
        role: "PIC",
        authProvider: "SSO",
        unitId: "assigned-unit",
        unit: { id: "assigned-unit", name: "Kanwil", type: "KANTOR_WILAYAH" },
        isActive: true,
      },
    });

    assert.equal(
      link,
      "/admin/management?unitId=assigned-unit&nip=12345&unitType=KANWIL",
    );
    assert.equal(
      getEmployeePicManagementLink({ ...baseEmployee, user: null }),
      null,
    );
  });

  it("does not expose self-deactivate or self-revoke controls", () => {
    assert.deepEqual(
      getEmployeeAdminActions(
        {
          ...baseEmployee,
          user: {
            id: "admin-1",
            name: "Admin",
            username: "12345",
            role: "ADMIN",
            authProvider: "SSO",
            unitId: null,
            unit: null,
            isActive: true,
          },
        },
        "admin-1",
      ),
      [],
    );

    assert.deepEqual(
      getEmployeeAdminActions(
        {
          ...baseEmployee,
          user: {
            id: "admin-2",
            name: "Admin",
            username: "12345",
            role: "ADMIN",
            authProvider: "SSO",
            unitId: null,
            unit: null,
            isActive: true,
          },
        },
        "admin-1",
      ),
      ["DEACTIVATE", "REVOKE_ADMIN"],
    );
  });

  it("requires both unit and NIP before applying a deep link", () => {
    assert.deepEqual(
      parseEmployeeManagementDeepLink(
        new URLSearchParams("unitId=assigned-unit&nip=12345&unitType=KANWIL"),
      ),
      { unitId: "assigned-unit", nip: "12345", unitType: "KANWIL" },
    );
    assert.equal(
      parseEmployeeManagementDeepLink(new URLSearchParams("nip=12345")),
      null,
    );
    assert.equal(
      parseEmployeeManagementDeepLink(
        new URLSearchParams("unitId=u&nip=n&unitType=UNKNOWN"),
      ),
      null,
    );
    assert.match(
      getEmployeeManagementDeepLinkWarning(new URLSearchParams("nip=12345")) ?? "",
      /tidak lengkap/,
    );
    assert.equal(
      getEmployeeManagementDeepLinkWarning(new URLSearchParams("unitId=u&nip=n")),
      "Deep-link Manajemen PIC tidak lengkap atau tidak valid; silakan pilih unit dan cari NIP secara manual.",
    );
    assert.match(
      getEmployeeManagementDeepLinkWarning(
        new URLSearchParams("unitId=u&nip=n&unitType=UNKNOWN"),
      ) ?? "",
      /tidak valid/,
    );
  });
});
