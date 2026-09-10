import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEmployeeAdminErrorMessage } from "@/lib/employee-admin-error";

describe("employee admin mutation errors", () => {
  it("prefers a rejected Axios response message", () => {
    const error = Object.assign(new Error("generic transport error"), {
      isAxiosError: true,
      response: { data: { message: "Akun tidak dapat diubah" } },
    });

    assert.equal(
      getEmployeeAdminErrorMessage(error),
      "Akun tidak dapat diubah",
    );
  });

  it("falls back safely for non-Axios errors", () => {
    assert.equal(
      getEmployeeAdminErrorMessage(new Error("fallback error")),
      "fallback error",
    );
    assert.equal(
      getEmployeeAdminErrorMessage({ unexpected: true }),
      "Terjadi kesalahan tidak terduga",
    );
  });
});
