import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertUatMirrorTarget, expectedUatMirrorTarget } from "./uat-mirror-guard";

describe("UAT mirror target guard", () => {
  const env = {
    NODE_ENV: "test" as const,
    UAT_DB_HOST: "10.0.0.1",
    UAT_DB_NAME: "uat_database",
    UAT_MIRROR_COUNT: "4647",
  };

  it("accepts only the independently confirmed database and full mirror count", () => {
    const expected = expectedUatMirrorTarget(env);
    assert.doesNotThrow(() =>
      assertUatMirrorTarget(expected, {
        host: "10.0.0.1",
        database: "uat_database",
        mirrorCount: 4647,
      }),
    );
    for (const actual of [
      { host: "127.0.0.1", database: "uat_database", mirrorCount: 4647 },
      { host: "10.0.0.1", database: "other", mirrorCount: 4647 },
      { host: "10.0.0.1", database: "uat_database", mirrorCount: 4646 },
    ]) {
      assert.throws(() => assertUatMirrorTarget(expected, actual));
    }
  });

  it("rejects incomplete or invalid target declarations", () => {
    for (const invalid of [
      { ...env, UAT_DB_HOST: "" },
      { ...env, UAT_DB_NAME: "" },
      { ...env, UAT_MIRROR_COUNT: "0" },
      { ...env, UAT_MIRROR_COUNT: "NaN" },
    ]) {
      assert.throws(() => expectedUatMirrorTarget(invalid));
    }
  });
});
