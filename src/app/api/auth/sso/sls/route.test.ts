import assert from "node:assert/strict";
import {
  constants,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  sign as signBytes,
} from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";
import { ValidateInResponseTo } from "@node-saml/node-saml";
import { SignedXml } from "xml-crypto";
import jwt from "jsonwebtoken";

const ORIGIN = "https://app.example.test";
const SLS = `${ORIGIN}/api/auth/sso/sls`;
const ISSUER = "https://sso-test.bulog.co.id/idp";
const NAME_ID = "persistent-name-1";
const NIP = "NIP-1";
const FORMAT = "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent";
const PROTOCOL = "urn:oasis:names:tc:SAML:2.0:protocol";
const ASSERTION = "urn:oasis:names:tc:SAML:2.0:assertion";
const RSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const RELAY = "test-relay-state";
const CONTEXT_COOKIE = "sso_logout_context";
const RELAY_COOKIE = "sso_logout_relay_state";

Reflect.set(process.env, "NODE_ENV", "test");
process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
process.env.SAML_IDP_ISSUER = ISSUER;
process.env.SAML_NAME_ID_FORMAT = FORMAT;
process.env.SSO_JWT_SECRET = "saml-route-test-secret-with-more-than-32-bytes";

function der(tag: number, bytes: Buffer): Buffer {
  let length: Buffer;
  if (bytes.length < 128) length = Buffer.from([bytes.length]);
  else {
    const octets: number[] = [];
    for (let size = bytes.length; size > 0; size = Math.floor(size / 256)) {
      octets.unshift(size & 255);
    }
    length = Buffer.from([0x80 | octets.length, ...octets]);
  }
  return Buffer.concat([Buffer.from([tag]), length, bytes]);
}

function derSequence(...parts: Buffer[]): Buffer {
  return der(0x30, Buffer.concat(parts));
}

function derInteger(value: number): Buffer {
  const bytes: number[] = [];
  for (let current = value; current > 0; current = Math.floor(current / 256)) {
    bytes.unshift(current & 255);
  }
  if (!bytes.length) bytes.push(0);
  if ((bytes[0] & 0x80) !== 0) bytes.unshift(0);
  return der(0x02, Buffer.from(bytes));
}

function derOid(bytes: number[]): Buffer {
  return der(0x06, Buffer.from(bytes));
}

function derUtcTime(date: Date): Buffer {
  const two = (value: number) => String(value).padStart(2, "0");
  const value = `${two(date.getUTCFullYear() % 100)}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}Z`;
  return der(0x17, Buffer.from(value));
}

function selfSignedCertificate(privateKey: string, publicKey: string): string {
  const name = derSequence(
    der(
      0x31,
      derSequence(
        derOid([0x55, 0x04, 0x03]),
        der(0x0c, Buffer.from("SLS Route Test IdP")),
      ),
    ),
  );
  const signatureAlgorithm = derSequence(
    derOid([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]),
    der(0x05, Buffer.alloc(0)),
  );
  const validity = derSequence(
    derUtcTime(new Date(Date.now() - 60_000)),
    derUtcTime(new Date(Date.now() + 86_400_000)),
  );
  const tbs = derSequence(
    der(0xa0, derInteger(2)),
    derInteger(1),
    signatureAlgorithm,
    name,
    validity,
    name,
    Buffer.from(
      createPublicKey(publicKey).export({ format: "der", type: "spki" }),
    ),
  );
  const signature = signBytes("sha256", tbs, {
    key: privateKey,
    padding: constants.RSA_PKCS1_PADDING,
  });
  const certificate = derSequence(
    tbs,
    signatureAlgorithm,
    der(0x03, Buffer.concat([Buffer.from([0]), signature])),
  );
  const base64 = certificate
    .toString("base64")
    .match(/.{1,64}/g)!
    .join("\n");
  return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;
}

const idpKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const idpCertificate = selfSignedCertificate(
  idpKeys.privateKey,
  idpKeys.publicKey,
);
const spKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const spCertificate = selfSignedCertificate(
  spKeys.privateKey,
  spKeys.publicKey,
);
process.env.SAML_IDP_CERT = idpCertificate;
process.env.SAML_SP_PRIVATE_KEY = spKeys.privateKey;
process.env.SAML_SP_CERT = spCertificate;
process.env.SAML_ENTRY_POINT = "https://idp.example.test/sso";
process.env.SAML_LOGOUT_URL = "https://idp.example.test/slo";
process.env.SAML_SP_ENTITY_ID = "test-sp";

type SessionFixture = { user?: { id?: string; authProvider?: string } } | null;
let session: SessionFixture = null;
let dbUser: { authProvider: string; employee: { nip: string } | null } = {
  authProvider: "SSO",
  employee: { nip: NIP },
};
const authMock = mock.fn(async () => session);
const signOutMock = mock.fn(async () => undefined);
const userFindMock = mock.fn(async () => dbUser);

mock.module("@/auth", {
  namedExports: { auth: authMock, signOut: signOutMock },
});
mock.module("@/lib/prisma", {
  namedExports: { prisma: { user: { findUnique: userFindMock } } },
});

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
}

function logoutRequestXml(
  id: string,
  options: {
    issuer?: string;
    nameID?: string;
    format?: string;
    sessionIndex?: string | null;
    destination?: string;
    issueInstant?: string;
  } = {},
): string {
  const sessionIndex =
    options.sessionIndex === null
      ? ""
      : `<p:SessionIndex>${xmlEscape(options.sessionIndex ?? "SID-1")}</p:SessionIndex>`;
  return `<p:LogoutRequest xmlns:p="${PROTOCOL}" xmlns:a="${ASSERTION}" ID="${xmlEscape(id)}" Version="2.0" IssueInstant="${options.issueInstant ?? new Date().toISOString()}" Destination="${options.destination ?? SLS}"><a:Issuer>${xmlEscape(options.issuer ?? ISSUER)}</a:Issuer><a:NameID Format="${xmlEscape(options.format ?? FORMAT)}">${xmlEscape(options.nameID ?? NAME_ID)}</a:NameID>${sessionIndex}</p:LogoutRequest>`;
}

function logoutResponseXml(
  id: string,
  inResponseTo: string,
  options: {
    issuer?: string;
    destination?: string;
    issueInstant?: string;
    status?: string;
  } = {},
): string {
  return `<p:LogoutResponse xmlns:p="${PROTOCOL}" xmlns:a="${ASSERTION}" ID="${xmlEscape(id)}" Version="2.0" IssueInstant="${options.issueInstant ?? new Date().toISOString()}" Destination="${options.destination ?? SLS}" InResponseTo="${xmlEscape(inResponseTo)}"><a:Issuer>${xmlEscape(options.issuer ?? ISSUER)}</a:Issuer><p:Status><p:StatusCode Value="${options.status ?? "urn:oasis:names:tc:SAML:2.0:status:Success"}"/></p:Status></p:LogoutResponse>`;
}

function signedRedirect(
  xml: string,
  field: "SAMLRequest" | "SAMLResponse",
  relay: string | null = RELAY,
): string {
  const signedParts = [
    `${field}=${encodeURIComponent(deflateRawSync(Buffer.from(xml)).toString("base64"))}`,
  ];
  if (relay !== null)
    signedParts.push(`RelayState=${encodeURIComponent(relay)}`);
  signedParts.push(`SigAlg=${encodeURIComponent(RSA_SHA256)}`);
  const signedFields = signedParts.join("&");
  const signer = createSign("RSA-SHA256");
  signer.update(signedFields, "utf8");
  signer.end();
  return `${signedFields}&Signature=${encodeURIComponent(signer.sign(idpKeys.privateKey, "base64"))}`;
}

function unsignedRedirect(
  xml: string,
  field: "SAMLRequest" | "SAMLResponse" = "SAMLResponse",
  relay: string | null = RELAY,
): string {
  const message = encodeURIComponent(
    deflateRawSync(Buffer.from(xml)).toString("base64"),
  );
  return `${field}=${message}${relay === null ? "" : `&RelayState=${encodeURIComponent(relay)}`}`;
}

function signedRootXml(xml: string): string {
  const signature = new SignedXml({
    privateKey: idpKeys.privateKey,
    publicCert: idpCertificate,
    signatureAlgorithm: RSA_SHA256,
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });
  signature.addReference({
    xpath: "/*",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });
  signature.computeSignature(xml, {
    location: { reference: "/*", action: "append" },
  });
  return signature.getSignedXml();
}

function contextToken(
  options: {
    nip?: string;
    issuer?: string;
    nameID?: string;
    format?: string;
    sessionIndex?: string;
  } = {},
): string {
  assert.ok(
    createLogoutContextToken,
    "SAML logout context helper is loaded before tests",
  );
  return createLogoutContextToken({
    nip: options.nip ?? NIP,
    profile: {
      issuer: options.issuer ?? ISSUER,
      nameID: options.nameID ?? NAME_ID,
      nameIDFormat: options.format ?? FORMAT,
      ...(options.sessionIndex === undefined
        ? { sessionIndex: "SID-1" }
        : { sessionIndex: options.sessionIndex }),
    },
  });
}

function requestCookies(
  options: { relay?: string; context?: string | null } = {},
): string {
  const cookies: string[] = [];
  if (options.context !== null)
    cookies.push(`${CONTEXT_COOKIE}=${options.context ?? contextToken()}`);
  if (options.relay !== undefined)
    cookies.push(`${RELAY_COOKIE}=${options.relay}`);
  return cookies.join("; ");
}

function getRequest(query: string, cookies = requestCookies()): NextRequest {
  return new NextRequest(`${SLS}?${query}`, {
    headers: cookies ? { cookie: cookies } : {},
  });
}

function postRequest(
  xml: string,
  options: {
    relay?: string;
    cookieRelay?: string;
    field?: "SAMLResponse" | "SAMLRequest";
    contentType?: string;
    cookies?: string;
    tamperSignature?: boolean;
  } = {},
): NextRequest {
  const field = options.field ?? "SAMLResponse";
  let signedXml = signedRootXml(xml);
  if (options.tamperSignature) {
    const tamperedXml = signedXml.replace(
      /(<(?:[\w.-]+:)?SignatureValue\b[^>]*>)([^<])/,
      (_whole, prefix: string, first: string) =>
        `${prefix}${first === "A" ? "B" : "A"}`,
    );
    assert.notEqual(
      tamperedXml,
      signedXml,
      "SignatureValue fixture is tampered",
    );
    signedXml = tamperedXml;
  }
  const encoded = Buffer.from(signedXml).toString("base64");
  const fields = [`${field}=${encodeURIComponent(encoded)}`];
  if (options.relay !== undefined)
    fields.push(`RelayState=${encodeURIComponent(options.relay)}`);
  const cookies =
    options.cookies ??
    requestCookies({
      ...(options.cookieRelay === undefined
        ? {}
        : { relay: options.cookieRelay }),
    });
  return new NextRequest(SLS, {
    method: "POST",
    headers: {
      "content-type":
        options.contentType ?? "application/x-www-form-urlencoded",
      ...(cookies ? { cookie: cookies } : {}),
    },
    body: fields.join("&"),
  });
}

function formRequest(body: string): NextRequest {
  return new NextRequest(SLS, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

function responseCookies(response: Response): string {
  return response.headers.get("set-cookie") ?? "";
}

function logoutResponseFromRedirect(response: Response): string {
  const location = response.headers.get("location");
  assert.ok(location, "IdP LogoutResponse redirect has a Location header");
  const encoded = new URL(location).searchParams.get("SAMLResponse");
  assert.ok(encoded, "IdP redirect contains SAMLResponse");
  return inflateRawSync(Buffer.from(encoded, "base64")).toString("utf8");
}

let GET: (request: NextRequest) => Promise<Response>;
let POST: (request: NextRequest) => Promise<Response>;
let ReplayStore: new () => {
  claim(id: string, now?: number): "claimed" | "replay" | "full";
};
let actualNodeSaml: typeof import("@/lib/saml").saml;
let createLogoutContextToken: typeof import("@/lib/saml-logout").createLogoutContextToken;

before(async () => {
  ({ saml: actualNodeSaml } = await import("@/lib/saml"));
  ({ createLogoutContextToken } = await import("@/lib/saml-logout"));
  const route = await import("./route");
  GET = route.GET;
  POST = route.POST;
  ReplayStore = route.BoundedInboundLogoutReplayStore;
});

beforeEach(() => {
  session = { user: { id: "user-1", authProvider: "SSO" } };
  dbUser = { authProvider: "SSO", employee: { nip: NIP } };
  authMock.mock.resetCalls();
  signOutMock.mock.resetCalls();
  userFindMock.mock.resetCalls();
});

describe("SLS inbound Redirect LogoutRequest", () => {
  it("validates a real RSA-SHA256 Redirect signature, binds the active SSO profile, then signs out once", async () => {
    const request = getRequest(
      signedRedirect(logoutRequestXml("_in-active"), "SAMLRequest"),
    );
    const response = await GET(request);
    assert.equal(response.status, 302);
    assert.equal(authMock.mock.callCount(), 1);
    assert.equal(userFindMock.mock.callCount(), 1);
    assert.equal(signOutMock.mock.callCount(), 1);
    assert.match(
      logoutResponseFromRedirect(response),
      /InResponseTo=["']_in-active["']/,
    );
    assert.match(responseCookies(response), /sso_logout_context=/);
  });

  it("answers a valid request without a session idempotently and claims its ID before generation", async () => {
    session = null;
    const query = signedRedirect(
      logoutRequestXml("_in-anonymous"),
      "SAMLRequest",
    );
    const first = await GET(getRequest(query, ""));
    assert.equal(first.status, 302);
    assert.match(
      logoutResponseFromRedirect(first),
      /InResponseTo=["']_in-anonymous["']/,
    );
    assert.equal(authMock.mock.callCount(), 1);
    assert.equal(userFindMock.mock.callCount(), 0);
    assert.equal(signOutMock.mock.callCount(), 0);
    const second = await GET(getRequest(query, ""));
    assert.equal(second.status, 400);
  });

  it("never signs out a LOCAL session and still claims its valid request against replay", async () => {
    session = { user: { id: "local-1", authProvider: "LOCAL" } };
    const query = signedRedirect(logoutRequestXml("_in-local"), "SAMLRequest");
    assert.equal((await GET(getRequest(query))).status, 302);
    assert.equal(userFindMock.mock.callCount(), 0);
    assert.equal(signOutMock.mock.callCount(), 0);
    assert.equal((await GET(getRequest(query))).status, 400);
  });

  it("rejects bad context, expired context, missing linked employee, NIP and profile mismatches before signOut", async () => {
    const query = signedRedirect(
      logoutRequestXml("_in-bad-context"),
      "SAMLRequest",
    );
    assert.equal(
      (await GET(getRequest(query, requestCookies({ context: null })))).status,
      403,
    );
    assert.equal(
      (await GET(getRequest(query, requestCookies({ context: "tampered" }))))
        .status,
      403,
    );
    const validContext = contextToken();
    assert.equal(
      (
        await GET(
          getRequest(
            query,
            `${CONTEXT_COOKIE}=${validContext}; ${CONTEXT_COOKIE}=${validContext}`,
          ),
        )
      ).status,
      403,
    );

    const expired = jwt.sign(
      {
        purpose: "saml-logout-context",
        nip: NIP,
        issuer: ISSUER,
        nameID: NAME_ID,
        nameIDFormat: FORMAT,
        sessionIndex: "SID-1",
        exp: Math.floor(Date.now() / 1000) - 5,
      },
      process.env.SSO_JWT_SECRET!,
    );
    assert.equal(
      (await GET(getRequest(query, requestCookies({ context: expired }))))
        .status,
      403,
    );

    dbUser = { authProvider: "SSO", employee: null };
    assert.equal((await GET(getRequest(query))).status, 403);
    dbUser = { authProvider: "SSO", employee: { nip: "OTHER-NIP" } };
    assert.equal((await GET(getRequest(query))).status, 403);
    dbUser = { authProvider: "SSO", employee: { nip: NIP } };
    assert.equal(
      (
        await GET(
          getRequest(
            query,
            requestCookies({ context: contextToken({ nip: "OTHER-NIP" }) }),
          ),
        )
      ).status,
      403,
    );

    const profileCases = [
      {
        xml: logoutRequestXml("_in-wrong-name", { nameID: "other-name" }),
        status: 403,
      },
      {
        xml: logoutRequestXml("_in-wrong-index", { sessionIndex: "OTHER-SID" }),
        status: 403,
      },
      {
        xml: logoutRequestXml("_in-missing-index", { sessionIndex: null }),
        status: 403,
      },
      {
        xml: logoutRequestXml("_in-wrong-issuer", {
          issuer: "https://attacker.example/idp",
        }),
        status: 400,
      },
    ];
    for (const item of profileCases) {
      const response = await GET(
        getRequest(signedRedirect(item.xml, "SAMLRequest"), requestCookies()),
      );
      assert.equal(response.status, item.status);
    }
    assert.equal(signOutMock.mock.callCount(), 0);
  });

  it("rejects invalid signature, issuer, destination and IssueInstant before auth or mutation", async () => {
    const valid = signedRedirect(
      logoutRequestXml("_in-invalid-signature"),
      "SAMLRequest",
    );
    const invalidSignature = valid.replace(
      /Signature=[^&]+$/,
      "Signature=AAAA",
    );
    assert.equal((await GET(getRequest(invalidSignature))).status, 400);

    const cases = [
      logoutRequestXml("_in-bad-issuer", {
        issuer: "https://attacker.example/idp",
      }),
      logoutRequestXml("_in-bad-destination", {
        destination: "https://attacker.example/sls",
      }),
      logoutRequestXml("_in-old-time", {
        issueInstant: new Date(Date.now() - 301_000).toISOString(),
      }),
      logoutRequestXml("_in-future-time", {
        issueInstant: new Date(Date.now() + 31_000).toISOString(),
      }),
      logoutRequestXml("_in-transient", {
        format: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
      }),
    ];
    for (let index = 0; index < cases.length; index++) {
      const response = await GET(
        getRequest(signedRedirect(cases[index], "SAMLRequest")),
      );
      assert.ok(response.status === 400 || response.status === 403);
    }
    assert.equal(authMock.mock.callCount(), 0);
    assert.equal(userFindMock.mock.callCount(), 0);
    assert.equal(signOutMock.mock.callCount(), 0);
  });

  it("does not replay-claim a valid signed request until its active SSO context is matched", async () => {
    const query = signedRedirect(
      logoutRequestXml("_in-context-before-claim"),
      "SAMLRequest",
    );
    const rejected = await GET(
      getRequest(query, requestCookies({ context: "invalid-context" })),
    );
    assert.equal(rejected.status, 403);
    assert.equal(signOutMock.mock.callCount(), 0);
    const matched = await GET(
      getRequest(query, requestCookies({ context: contextToken() })),
    );
    assert.equal(matched.status, 302);
    assert.equal(signOutMock.mock.callCount(), 1);
  });

  it("rejects replay and concurrent duplicate claims atomically, and refuses capacity without eviction", async () => {
    const store = new ReplayStore();
    assert.equal(store.claim("same", 100), "claimed");
    assert.equal(store.claim("same", 101), "replay");
    assert.equal(store.claim("same", 100 + 6 * 60 * 1000), "claimed");

    const parallelStore = new ReplayStore();
    const outcomes = await Promise.all(
      Array.from({ length: 32 }, () =>
        Promise.resolve(parallelStore.claim("racing-id", 500)),
      ),
    );
    assert.equal(outcomes.filter((outcome) => outcome === "claimed").length, 1);
    assert.equal(outcomes.filter((outcome) => outcome === "replay").length, 31);

    const fullStore = new ReplayStore();
    for (let index = 0; index < 4096; index++)
      assert.equal(fullStore.claim(`capacity-${index}`, 1000), "claimed");
    assert.equal(fullStore.claim("capacity-overflow", 1000), "full");
    assert.equal(fullStore.claim("capacity-0", 1000), "replay");
  });

  it("makes no auth, replay, cookie, signOut or IdP-response effects for invalid Redirect and POST SAMLRequest", async () => {
    const originalGenerator =
      actualNodeSaml.getLogoutResponseUrlAsync.bind(actualNodeSaml);
    let generatedResponses = 0;
    actualNodeSaml.getLogoutResponseUrlAsync = async (...args) => {
      generatedResponses++;
      return originalGenerator(...args);
    };
    try {
      await actualNodeSaml.cacheProvider.saveAsync(
        "_out-invalid-sentinel",
        "sentinel",
      );
      const invalid = await GET(
        getRequest("SAMLRequest=not-base64&SigAlg=x&Signature=y"),
      );
      assert.equal(invalid.status, 400);
      assert.equal(responseCookies(invalid), "");
      assert.equal(authMock.mock.callCount(), 0);
      assert.equal(signOutMock.mock.callCount(), 0);
      assert.equal(
        await actualNodeSaml.cacheProvider.getAsync("_out-invalid-sentinel"),
        "sentinel",
      );

      const postRequest = formRequest("SAMLRequest=well-formed-field");
      const rejected = await POST(postRequest);
      assert.equal(rejected.status, 405);
      assert.equal(rejected.headers.get("allow"), "GET");
      assert.equal(responseCookies(rejected), "");
      assert.equal(authMock.mock.callCount(), 0);
      assert.equal(userFindMock.mock.callCount(), 0);
      assert.equal(signOutMock.mock.callCount(), 0);
      assert.equal(
        await actualNodeSaml.cacheProvider.getAsync("_out-invalid-sentinel"),
        "sentinel",
      );
      assert.equal(generatedResponses, 0);
    } finally {
      actualNodeSaml.getLogoutResponseUrlAsync = originalGenerator;
    }
  });

  it("awaits active SSO signOut and returns a safe terminal failure if LogoutResponse generation fails", async () => {
    const original =
      actualNodeSaml.getLogoutResponseUrlAsync.bind(actualNodeSaml);
    actualNodeSaml.getLogoutResponseUrlAsync = async () => {
      throw new Error("response generation test failure");
    };
    try {
      const response = await GET(
        getRequest(
          signedRedirect(logoutRequestXml("_in-generate-fail"), "SAMLRequest"),
        ),
      );
      assert.equal(response.status, 302);
      assert.match(responseCookies(response), /sso_logout_context=/);
      assert.match(
        response.headers.get("location") ?? "",
        /\/login\?logout=failed$/,
      );
      assert.equal(signOutMock.mock.callCount(), 1);
    } finally {
      actualNodeSaml.getLogoutResponseUrlAsync = original;
    }
  });
});

describe("SLS Redirect and POST LogoutResponse callbacks", () => {
  async function seedCorrelation(id: string): Promise<void> {
    await actualNodeSaml.cacheProvider.saveAsync(id, String(Date.now()));
  }

  async function seedExpiredCorrelation(id: string): Promise<void> {
    const currentNow = Date.now;
    Date.now = () => currentNow() - 6 * 60 * 1000;
    try {
      await actualNodeSaml.cacheProvider.saveAsync(id, "expired-correlation");
    } finally {
      Date.now = currentNow;
    }
  }

  it("accepts a real signed GET response, consumes InResponseTo once, clears SLO cookies and never server-signs-out", async () => {
    await seedCorrelation("_out-get-ok");
    const xml = logoutResponseXml("_response-get-ok", "_out-get-ok");
    const request = getRequest(
      signedRedirect(xml, "SAMLResponse"),
      requestCookies({ relay: RELAY, context: contextToken() }),
    );
    const response = await GET(request);
    assert.equal(response.status, 302);
    assert.match(
      response.headers.get("location") ?? "",
      /\/login\?logout=success$/,
    );
    assert.match(responseCookies(response), /sso_logout_relay_state=/);
    assert.match(responseCookies(response), /sso_logout_context=/);
    assert.equal(signOutMock.mock.callCount(), 0);
    assert.equal(
      await actualNodeSaml.cacheProvider.removeAsync("_out-get-ok"),
      null,
    );
    assert.equal(
      (await GET(request)).headers.get("location")?.endsWith("logout=failed"),
      true,
    );
  });

  it("accepts only a correlated unsigned GET response as success", async () => {
    await seedCorrelation("_out-unsigned-ok");
    const query = unsignedRedirect(
      logoutResponseXml("_response-unsigned-ok", "_out-unsigned-ok"),
    );
    const request = getRequest(
      query,
      requestCookies({ relay: RELAY, context: contextToken() }),
    );
    const response = await GET(request);
    assert.equal(response.headers.get("location"), `${ORIGIN}/login?logout=success`);
    assert.match(responseCookies(response), /sso_logout_relay_state=/);
    assert.match(responseCookies(response), /sso_logout_context=/);
    assert.equal(signOutMock.mock.callCount(), 0);
    assert.equal(await actualNodeSaml.cacheProvider.getAsync("_out-unsigned-ok"), null);
    assert.equal((await GET(request)).headers.get("location"), `${ORIGIN}/login?logout=failed`);

    await seedCorrelation("_out-unsigned-mismatch");
    const mismatch = await GET(getRequest(
      unsignedRedirect(logoutResponseXml("_response-unsigned-mismatch", "_out-unsigned-mismatch"), "SAMLResponse", "wrong-relay"),
      requestCookies({ relay: RELAY }),
    ));
    assert.equal(mismatch.headers.get("location"), `${ORIGIN}/login?logout=failed`);
    assert.notEqual(await actualNodeSaml.cacheProvider.getAsync("_out-unsigned-mismatch"), null);

    await seedCorrelation("_out-unsigned-failure");
    const failure = await GET(getRequest(
      unsignedRedirect(logoutResponseXml("_response-unsigned-failure", "_out-unsigned-failure", {
        status: "urn:oasis:names:tc:SAML:2.0:status:Responder",
      })),
      requestCookies({ relay: RELAY }),
    ));
    assert.equal(failure.headers.get("location"), `${ORIGIN}/login?logout=failed`);
  });

  it("preserves the fixed rejected-login status only for the cookie-bound rejected relay", async () => {
    const rejectedRelay = `rejected.${"R".repeat(43)}`;
    await seedCorrelation("_out-rejected-ok");
    const request = getRequest(
      signedRedirect(
        logoutResponseXml("_response-rejected-ok", "_out-rejected-ok"),
        "SAMLResponse",
        rejectedRelay,
      ),
      requestCookies({ relay: rejectedRelay, context: contextToken() }),
    );

    const response = await GET(request);
    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("location"),
      `${ORIGIN}/login?error=SSOAccessRejected&logout=success`,
    );
    assert.match(responseCookies(response), /sso_logout_relay_state=/);
    assert.match(responseCookies(response), /sso_logout_context=/);

    await seedCorrelation("_out-rejected-failed");
    const failedXml = logoutResponseXml(
      "_response-rejected-failed",
      "_out-rejected-failed",
      { status: "urn:oasis:names:tc:SAML:2.0:status:Responder" },
    );
    const failed = await GET(
      getRequest(
        signedRedirect(failedXml, "SAMLResponse", rejectedRelay),
        requestCookies({ relay: rejectedRelay, context: contextToken() }),
      ),
    );
    assert.equal(
      failed.headers.get("location"),
      `${ORIGIN}/login?error=SSOAccessRejected&logout=failed`,
    );

    await seedCorrelation("_out-rejected-unsigned");
    const unsigned = await GET(getRequest(
      unsignedRedirect(
        logoutResponseXml("_response-rejected-unsigned", "_out-rejected-unsigned"),
        "SAMLResponse",
        rejectedRelay,
      ),
      requestCookies({ relay: rejectedRelay }),
    ));
    assert.equal(
      unsigned.headers.get("location"),
      `${ORIGIN}/login?error=SSOAccessRejected&logout=success`,
    );

    const mismatch = await GET(
      getRequest(
        signedRedirect(
          logoutResponseXml("_response-rejected-mismatch", "_unknown-id"),
          "SAMLResponse",
          rejectedRelay,
        ),
        requestCookies({ relay: rejectedRelay, context: contextToken() }),
      ),
    );
    assert.equal(
      mismatch.headers.get("location"),
      `${ORIGIN}/login?logout=failed`,
    );

    const relayMismatch = await GET(
      getRequest(
        signedRedirect(
          logoutResponseXml("_response-rejected-relay-mismatch", "_out-rejected-ok"),
          "SAMLResponse",
          "attacker-relay",
        ),
        requestCookies({ relay: rejectedRelay, context: contextToken() }),
      ),
    );
    assert.equal(
      relayMismatch.headers.get("location"),
      `${ORIGIN}/login?logout=failed`,
    );

    const replay = await GET(request);
    assert.equal(
      replay.headers.get("location"),
      `${ORIGIN}/login?logout=failed`,
    );
  });

  it("rejects RelayState, issuer, Destination, IssueInstant and unknown InResponseTo without consuming correlation", async () => {
    const cases = [
      {
        key: "_out-bad-relay",
        xml: logoutResponseXml("_response-bad-relay", "_out-bad-relay"),
        relay: "wrong",
        cookie: RELAY,
      },
      {
        key: "_out-bad-issuer",
        xml: logoutResponseXml("_response-bad-issuer", "_out-bad-issuer", {
          issuer: "https://attacker.example/idp",
        }),
        relay: RELAY,
        cookie: RELAY,
      },
      {
        key: "_out-bad-destination",
        xml: logoutResponseXml(
          "_response-bad-destination",
          "_out-bad-destination",
          { destination: "https://attacker.example/sls" },
        ),
        relay: RELAY,
        cookie: RELAY,
      },
      {
        key: "_out-old-time",
        xml: logoutResponseXml("_response-old-time", "_out-old-time", {
          issueInstant: new Date(Date.now() - 301_000).toISOString(),
        }),
        relay: RELAY,
        cookie: RELAY,
      },
      {
        key: "_out-unknown",
        xml: logoutResponseXml("_response-unknown", "_out-absent"),
        relay: RELAY,
        cookie: RELAY,
      },
    ];
    for (const item of cases) {
      if (item.key !== "_out-unknown") await seedCorrelation(item.key);
      const response = await GET(
        getRequest(
          signedRedirect(item.xml, "SAMLResponse", item.relay),
          requestCookies({ relay: item.cookie, context: contextToken() }),
        ),
      );
      assert.equal(
        response.headers.get("location")?.endsWith("logout=failed"),
        true,
      );
      if (item.key !== "_out-unknown")
        assert.notEqual(
          await actualNodeSaml.cacheProvider.getAsync(item.key),
          null,
        );
    }
    assert.equal(signOutMock.mock.callCount(), 0);
  });

  it("rejects missing RelayState and duplicate RelayState cookies without consuming correlation", async () => {
    await seedCorrelation("_out-missing-relay");
    const missing = await GET(
      getRequest(
        signedRedirect(
          logoutResponseXml("_response-missing-relay", "_out-missing-relay"),
          "SAMLResponse",
          null,
        ),
        requestCookies({ relay: RELAY, context: contextToken() }),
      ),
    );
    assert.equal(
      missing.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    assert.notEqual(
      await actualNodeSaml.cacheProvider.getAsync("_out-missing-relay"),
      null,
    );

    const duplicateCookieCases = [
      {
        id: "_out-duplicate-cookie-same",
        cookie: `${RELAY_COOKIE}=${RELAY}; ${RELAY_COOKIE}=${RELAY}`,
      },
      {
        id: "_out-duplicate-cookie-attacker-first",
        cookie: `${RELAY_COOKIE}=attacker-state; ${RELAY_COOKIE}=${RELAY}`,
      },
      {
        id: "_out-duplicate-cookie-attacker-last",
        cookie: `${RELAY_COOKIE}=${RELAY}; ${RELAY_COOKIE}=attacker-state`,
      },
    ];
    for (const item of duplicateCookieCases) {
      await seedCorrelation(item.id);
      const duplicate = await GET(
        getRequest(
          signedRedirect(
            logoutResponseXml(`_response${item.id}`, item.id),
            "SAMLResponse",
          ),
          item.cookie,
        ),
      );
      assert.equal(
        duplicate.headers.get("location")?.endsWith("logout=failed"),
        true,
      );
      assert.notEqual(
        await actualNodeSaml.cacheProvider.getAsync(item.id),
        null,
      );
    }
    assert.equal(signOutMock.mock.callCount(), 0);
  });

  it("rejects expired signed GET and POST correlations after cache expiry pruning", async () => {
    await seedExpiredCorrelation("_out-expired-get");
    const query = signedRedirect(
      logoutResponseXml("_response-expired-get", "_out-expired-get"),
      "SAMLResponse",
    );
    const expiredGet = await GET(
      getRequest(
        query,
        requestCookies({ relay: RELAY, context: contextToken() }),
      ),
    );
    assert.equal(
      expiredGet.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    assert.equal(
      await actualNodeSaml.cacheProvider.getAsync("_out-expired-get"),
      null,
    );

    await seedExpiredCorrelation("_out-expired-post");
    const expiredPost = await POST(
      postRequest(
        logoutResponseXml("_response-expired-post", "_out-expired-post"),
        { relay: RELAY, cookieRelay: RELAY },
      ),
    );
    assert.equal(expiredPost.status, 303);
    assert.equal(
      expiredPost.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    assert.equal(
      await actualNodeSaml.cacheProvider.getAsync("_out-expired-post"),
      null,
    );
    assert.equal(signOutMock.mock.callCount(), 0);
  });

  it("uses configured safe origin when an unconfigured request has an attacker Host", async () => {
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    try {
      const request = new NextRequest(
        "https://attacker.example.test/api/auth/sso/sls",
        {
          method: "POST",
          headers: {
            host: "attacker.example.test",
            "content-type": "application/x-www-form-urlencoded",
          },
          body: "SAMLResponse=%GG&RelayState=state",
        },
      );
      const response = await POST(request);
      assert.equal(response.status, 303);
      assert.equal(
        response.headers.get("location"),
        "http://localhost:3000/login?logout=failed",
      );
      assert.equal(signOutMock.mock.callCount(), 0);
    } finally {
      if (configuredOrigin) process.env.NEXT_PUBLIC_APP_URL = configuredOrigin;
    }
  });

  it("rejects a tampered Redirect signature terminally without consuming the outstanding ID", async () => {
    await seedCorrelation("_out-tampered");
    const signed = signedRedirect(
      logoutResponseXml("_response-tampered", "_out-tampered"),
      "SAMLResponse",
    );
    const tampered = signed.replace(
      /Signature=([^&])/,
      (_whole, first: string) => `Signature=${first === "A" ? "B" : "A"}`,
    );
    const response = await GET(
      getRequest(
        tampered,
        requestCookies({ relay: RELAY, context: contextToken() }),
      ),
    );
    assert.equal(
      response.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    assert.notEqual(
      await actualNodeSaml.cacheProvider.getAsync("_out-tampered"),
      null,
    );
    assert.equal(signOutMock.mock.callCount(), 0);
  });

  it("accepts a real root-signed POST response with 303, consumes once, and clears both cookies without signOut", async () => {
    assert.equal(
      actualNodeSaml.options.validateInResponseTo,
      ValidateInResponseTo.always,
    );
    await seedCorrelation("_out-post-ok");
    const request = postRequest(
      logoutResponseXml("_response-post-ok", "_out-post-ok"),
      {
        relay: RELAY,
        cookieRelay: RELAY,
      },
    );
    const response = await POST(request);
    assert.equal(response.status, 303);
    assert.match(
      response.headers.get("location") ?? "",
      /\/login\?logout=success$/,
    );
    assert.match(responseCookies(response), /sso_logout_relay_state=/);
    assert.match(responseCookies(response), /sso_logout_context=/);
    assert.equal(signOutMock.mock.callCount(), 0);
    assert.equal(
      await actualNodeSaml.cacheProvider.removeAsync("_out-post-ok"),
      null,
    );
    const replay = await POST(
      postRequest(logoutResponseXml("_response-post-ok", "_out-post-ok"), {
        relay: RELAY,
        cookieRelay: RELAY,
      }),
    );
    assert.equal(replay.status, 303);
    assert.equal(
      replay.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    assert.equal(signOutMock.mock.callCount(), 0);
  });

  it("rejects POST RelayState, signed XML semantics and absent InResponseTo without consuming correlation", async () => {
    await seedCorrelation("_out-post-bad-relay");
    const badRelay = await POST(
      postRequest(
        logoutResponseXml("_response-post-bad-relay", "_out-post-bad-relay"),
        {
          relay: "attacker-state",
          cookieRelay: RELAY,
        },
      ),
    );
    assert.equal(badRelay.status, 303);
    assert.equal(
      badRelay.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    assert.notEqual(
      await actualNodeSaml.cacheProvider.getAsync("_out-post-bad-relay"),
      null,
    );

    await seedCorrelation("_out-post-bad-issuer");
    const badIssuer = await POST(
      postRequest(
        logoutResponseXml("_response-post-bad-issuer", "_out-post-bad-issuer", {
          issuer: "https://attacker.example/idp",
        }),
        { relay: RELAY, cookieRelay: RELAY },
      ),
    );
    assert.equal(badIssuer.status, 303);
    assert.notEqual(
      await actualNodeSaml.cacheProvider.getAsync("_out-post-bad-issuer"),
      null,
    );

    const postInvalidCases = [
      {
        key: "_out-post-bad-destination",
        xml: logoutResponseXml(
          "_response-post-bad-destination",
          "_out-post-bad-destination",
          { destination: "https://attacker.example/sls" },
        ),
      },
      {
        key: "_out-post-old-time",
        xml: logoutResponseXml(
          "_response-post-old-time",
          "_out-post-old-time",
          { issueInstant: new Date(Date.now() - 301_000).toISOString() },
        ),
      },
    ];
    for (const item of postInvalidCases) {
      await seedCorrelation(item.key);
      const rejected = await POST(
        postRequest(item.xml, { relay: RELAY, cookieRelay: RELAY }),
      );
      assert.equal(rejected.status, 303);
      assert.equal(
        rejected.headers.get("location")?.endsWith("logout=failed"),
        true,
      );
      assert.notEqual(
        await actualNodeSaml.cacheProvider.getAsync(item.key),
        null,
      );
    }

    await seedCorrelation("_out-post-bad-signature");
    const badSignature = await POST(
      postRequest(
        logoutResponseXml(
          "_response-post-bad-signature",
          "_out-post-bad-signature",
        ),
        { relay: RELAY, cookieRelay: RELAY, tamperSignature: true },
      ),
    );
    assert.equal(badSignature.status, 303);
    assert.equal(
      badSignature.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    assert.notEqual(
      await actualNodeSaml.cacheProvider.getAsync("_out-post-bad-signature"),
      null,
    );

    const absent = await POST(
      postRequest(
        logoutResponseXml("_response-post-absent", "_out-not-seeded"),
        {
          relay: RELAY,
          cookieRelay: RELAY,
        },
      ),
    );
    assert.equal(absent.status, 303);
    assert.equal(
      absent.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    assert.equal(signOutMock.mock.callCount(), 0);
  });

  it("rejects duplicate/missing/mismatched RelayState and malformed POST before auth, cache mutation or signOut", async () => {
    const xml = logoutResponseXml("_response-no-relay", "_out-no-relay");
    const encoded = Buffer.from(signedRootXml(xml)).toString("base64");
    const missingRelay = await POST(
      formRequest(`SAMLResponse=${encodeURIComponent(encoded)}`),
    );
    assert.equal(missingRelay.status, 303);
    assert.equal(
      missingRelay.headers.get("location")?.endsWith("logout=failed"),
      true,
    );

    const duplicate = await POST(
      formRequest(
        `SAMLResponse=${encodeURIComponent(encoded)}&RelayState=${RELAY}&RelayState=${RELAY}`,
      ),
    );
    assert.equal(duplicate.status, 400);
    assert.equal(responseCookies(duplicate), "");

    const malformed = await POST(formRequest("SAMLResponse=%GG"));
    assert.equal(malformed.status, 303);
    assert.equal(
      malformed.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    const wrongType = await POST(
      postRequest(logoutResponseXml("_wrong-type", "_out-wrong-type"), {
        relay: RELAY,
        cookieRelay: RELAY,
        contentType: "text/plain",
      }),
    );
    assert.equal(wrongType.status, 400);
    assert.equal(responseCookies(wrongType), "");
    const oversized = await POST(
      formRequest(`SAMLResponse=${"A".repeat(256 * 1024 + 10)}`),
    );
    assert.equal(oversized.status, 400);
    assert.equal(responseCookies(oversized), "");
    assert.equal(authMock.mock.callCount(), 0);
    assert.equal(userFindMock.mock.callCount(), 0);
    assert.equal(signOutMock.mock.callCount(), 0);
  });

  it("rejects POST SAMLRequest with 405 and POST terminal callbacks always use 303", async () => {
    const unsupported = await POST(
      formRequest("SAMLRequest=well-formed-field"),
    );
    assert.equal(unsupported.status, 405);
    assert.equal(unsupported.headers.get("allow"), "GET");
    assert.equal(responseCookies(unsupported), "");

    const invalidResponse = await POST(
      formRequest("SAMLResponse=%%%&RelayState=state"),
    );
    assert.equal(invalidResponse.status, 303);
    assert.equal(
      invalidResponse.headers.get("location")?.endsWith("logout=failed"),
      true,
    );
    assert.equal(signOutMock.mock.callCount(), 0);
  });
});
