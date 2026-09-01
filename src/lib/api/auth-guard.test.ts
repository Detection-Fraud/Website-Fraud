import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleApiError } from "./auth-guard";

describe("handleApiError", () => {
  it("maps unique and serializable transaction conflicts to 409", async () => {
    for (const code of ["P2002", "P2034"]) {
      const response = handleApiError({ code }, "test");
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.error, true);
    }
  });
});
