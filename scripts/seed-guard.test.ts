import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDevelopmentSeedInvocation,
  assertUatUnitSeedInvocation,
} from "./seed-guard";

describe("development seed guard", () => {
  it("accepts only an explicitly confirmed development invocation", () => {
    assert.doesNotThrow(() =>
      assertDevelopmentSeedInvocation(
        {
          NODE_ENV: "development",
          SEED_CONFIRMATION: "I_UNDERSTAND_DEV_SEED",
        },
        ["node", "prisma/seed.ts", "--confirm-dev-seed"],
      ),
    );
  });

  it("rejects production, missing confirmation, or missing flag", () => {
    for (const env of [
      { NODE_ENV: "production", SEED_CONFIRMATION: "I_UNDERSTAND_DEV_SEED" },
      { NODE_ENV: "development" },
    ] satisfies NodeJS.ProcessEnv[]) {
      assert.throws(() =>
        assertDevelopmentSeedInvocation(env, [
          "node",
          "prisma/seed.ts",
          "--confirm-dev-seed",
        ]),
      );
    }

    assert.throws(() =>
      assertDevelopmentSeedInvocation(
        {
          NODE_ENV: "development",
          SEED_CONFIRMATION: "I_UNDERSTAND_DEV_SEED",
        },
        ["node", "prisma/seed.ts"],
      ),
    );
  });
});

describe("UAT Unit seed guard", () => {
  const env = {
    NODE_ENV: "test" as const,
    UAT_SEED_CONFIRMATION: "I_UNDERSTAND_UAT_SEED",
    UAT_ADMIN_USERNAME: "admin.uat",
    UAT_ADMIN_PASSWORD: "a-long-unique-password",
  };
  const args = ["node", "prisma/seed.ts", "--uat-units-admin"];

  it("requires a separate confirmation and strong Admin credential", () => {
    assert.deepEqual(assertUatUnitSeedInvocation(env, args), {
      username: "admin.uat",
      password: "a-long-unique-password",
    });
    assert.throws(() => assertUatUnitSeedInvocation({ ...env, UAT_ADMIN_PASSWORD: "password123" }, args));
    assert.throws(() => assertUatUnitSeedInvocation({ ...env, UAT_SEED_CONFIRMATION: "" }, args));
    assert.throws(() => assertUatUnitSeedInvocation(env, ["node", "prisma/seed.ts"]));
    assert.throws(() => assertUatUnitSeedInvocation(env, [...args, "--confirm-dev-seed"]));
  });
});
