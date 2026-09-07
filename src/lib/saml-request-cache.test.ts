import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoundedSamlRequestCache } from "./saml-request-cache";

describe("BoundedSamlRequestCache", () => {
  it("claims and deletes request IDs once", async () => {
    const cache = new BoundedSamlRequestCache({
      capacity: 4,
      keyExpirationPeriodMs: 60_000,
    });

    await cache.saveAsync("request-1", "created-at");

    assert.equal(await cache.getAsync("request-1"), "created-at");
    assert.equal(await cache.getAsync("request-1"), null);
  });

  it("allows only one parallel claimant", async () => {
    const cache = new BoundedSamlRequestCache({
      capacity: 4,
      keyExpirationPeriodMs: 60_000,
    });

    await cache.saveAsync("request-1", "created-at");

    const results = await Promise.all(
      Array.from({ length: 20 }, () => cache.getAsync("request-1")),
    );

    assert.equal(results.filter((result) => result === "created-at").length, 1);

    assert.equal(results.filter((result) => result === null).length, 19);
  });

  it("keeps removeAsync idempotent", async () => {
    const cache = new BoundedSamlRequestCache({
      capacity: 4,
      keyExpirationPeriodMs: 60_000,
    });

    await cache.saveAsync("request-1", "created-at");

    assert.equal(await cache.getAsync("request-1"), "created-at");
    assert.equal(await cache.removeAsync("request-1"), null);
    assert.equal(await cache.removeAsync("request-1"), null);
  });

  it("rejects entries above capacity", async () => {
    const cache = new BoundedSamlRequestCache({
      capacity: 1,
      keyExpirationPeriodMs: 60_000,
    });

    assert.notEqual(await cache.saveAsync("request-1", "created-at"), null);

    assert.equal(await cache.saveAsync("request-2", "created-at"), null);
  });
});
