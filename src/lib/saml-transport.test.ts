import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Profile } from "@node-saml/node-saml";
import {
  createRelayState,
  extractNip,
  getSsoBaseUrl,
  relayStateMatches,
} from "./saml-transport";

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    issuer: "https://idp.example.test",
    nameID: "NAME-001",
    nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
    ...overrides,
  };
}

describe("SAML transport helpers", () => {
  it("creates unpredictable RelayState values with sufficient length", () => {
    const first = createRelayState();
    const second = createRelayState();

    assert.equal(typeof first, "string");
    assert.equal(first.length >= 40, true);
    assert.notEqual(first, second);
  });

  it("compares equal RelayState values in a length-safe way", () => {
    assert.equal(relayStateMatches("relay-state", "relay-state"), true);
    assert.equal(relayStateMatches("relay-state", "relay-state-x"), false);
    assert.equal(relayStateMatches("", ""), true);
  });

  it("extracts the stable NIP attribute in priority order", () => {
    assert.equal(
      extractNip(
        profile({
          nip: "  NIP-001  ",
          uid: "UID-001",
          employeeID: "EMP-001",
        }),
      ),
      "NIP-001",
    );

    assert.equal(
      extractNip(
        profile({
          uid: " UID-001 ",
          employeeID: "EMP-001",
        }),
      ),
      "UID-001",
    );

    assert.equal(
      extractNip(
        profile({
          employeeID: " EMP-001 ",
        }),
      ),
      "EMP-001",
    );

    assert.equal(extractNip(profile()), "NAME-001");
  });

  it("uses NEXT_PUBLIC_APP_URL as the authoritative configured origin", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    setEnv("NODE_ENV", "production");
    setEnv("NEXT_PUBLIC_APP_URL", "https://fraud.example.test/");

    try {
      assert.equal(getSsoBaseUrl(), "https://fraud.example.test");
    } finally {
      setEnv("NODE_ENV", previousNodeEnv);
      setEnv("NEXT_PUBLIC_APP_URL", previousAppUrl);
    }
  });

  it("fails closed in production when NEXT_PUBLIC_APP_URL is absent", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    setEnv("NODE_ENV", "production");
    setEnv("NEXT_PUBLIC_APP_URL", undefined);

    try {
      assert.throws(() => getSsoBaseUrl());
    } finally {
      setEnv("NODE_ENV", previousNodeEnv);
      setEnv("NEXT_PUBLIC_APP_URL", previousAppUrl);
    }
  });

  it("uses the request origin only as a development fallback", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    setEnv("NODE_ENV", "development");
    setEnv("NEXT_PUBLIC_APP_URL", undefined);

    try {
      assert.equal(
        getSsoBaseUrl(
          new Request("http://localhost:3000/api/auth/sso/callback"),
        ),
        "http://localhost:3000",
      );
    } finally {
      setEnv("NODE_ENV", previousNodeEnv);
      setEnv("NEXT_PUBLIC_APP_URL", previousAppUrl);
    }
  });
});
