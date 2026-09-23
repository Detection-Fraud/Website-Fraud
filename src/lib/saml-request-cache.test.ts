import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BoundedSamlRequestCache } from "./saml-request-cache";

describe("BoundedSamlRequestCache", () => {
  it("keeps request IDs readable until node-saml removes them", async () => {
    const cache = new BoundedSamlRequestCache({
      capacity: 4,
      keyExpirationPeriodMs: 60_000,
    });

    await cache.saveAsync("request-1", "created-at");

    assert.equal(await cache.getAsync("request-1"), "created-at");
    assert.equal(await cache.getAsync("request-1"), "created-at");
    assert.equal(await cache.removeAsync("request-1"), "request-1");
    assert.equal(await cache.getAsync("request-1"), null);
  });

  it("supports node-saml reading the same request during response validation", async () => {
    const cache = new BoundedSamlRequestCache({
      capacity: 4,
      keyExpirationPeriodMs: 60_000,
    });

    await cache.saveAsync("request-1", "created-at");

    const results = await Promise.all(
      Array.from({ length: 20 }, () => cache.getAsync("request-1")),
    );

    assert.equal(results.every((result) => result === "created-at"), true);
  });

  it("keeps removeAsync idempotent", async () => {
    const cache = new BoundedSamlRequestCache({
      capacity: 4,
      keyExpirationPeriodMs: 60_000,
    });

    await cache.saveAsync("request-1", "created-at");

    assert.equal(await cache.removeAsync("request-1"), "request-1");
    assert.equal(await cache.removeAsync("request-1"), null);
  });

  it("rejects entries above capacity", async () => {
    const cache = new BoundedSamlRequestCache({
      capacity: 1,
      keyExpirationPeriodMs: 60_000,
    });

    assert.notEqual(await cache.saveAsync("request-1", "created-at"), null);

    await assert.rejects(
      cache.saveAsync("request-2", "created-at"),
      { message: "SAML request cache capacity reached" },
    );
  });
});
