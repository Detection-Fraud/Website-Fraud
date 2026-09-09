import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertDevelopmentSeedInvocation } from "./seed-guard";

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
