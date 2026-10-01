import assert from "node:assert/strict";
import {
  constants,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  randomUUID,
  sign as signBytes,
} from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { describe, it } from "node:test";
import { SAML, ValidateInResponseTo, type Profile } from "@node-saml/node-saml";
import { SignedXml } from "xml-crypto";
import jwt from "jsonwebtoken";

import {
  createLogoutContextToken,
  claimRejectedLogoutContextToken,
  extractLogoutProfile,
  InvalidSamlLogoutResponsePostError,
  renewLogoutContextToken,
  SAML_PERSISTENT_NAME_ID_FORMAT,
  type SamlLogoutValidator,
  UnsupportedSamlLogoutRequestPostError,
  validatePostLogoutResponse,
  validateRedirectLogoutMessage,
  verifyLogoutContextToken,
} from "./saml-logout";

function setEnv(name: string, value?: string) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

const TEST_IDP_ISSUER =
  "https://sso-test.bulog.co.id/saml/saml2/idp/metadata.php";
const TEST_APP_ORIGIN = "https://app.example.test";
const TEST_SLS_DESTINATION = `${TEST_APP_ORIGIN}/api/auth/sso/sls`;
const RSA_SHA256_URI = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const SAML_PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const SAML_ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  for (let value = length; value > 0; value = Math.floor(value / 256)) {
    bytes.unshift(value & 0xff);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(value.length), value]);
}

function derSequence(...values: Buffer[]): Buffer {
  return der(0x30, Buffer.concat(values));
}

function derSet(...values: Buffer[]): Buffer {
  return der(0x31, Buffer.concat(values));
}

function derInteger(value: number): Buffer {
  const bytes: number[] = [];
  for (
    let current = value;
    current > 0;
    current = Math.floor(current / 256)
  ) {
    bytes.unshift(current & 0xff);
  }
  if (bytes.length === 0) bytes.push(0);
  if (bytes[0] & 0x80) bytes.unshift(0);
  return der(0x02, Buffer.from(bytes));
}

function derUtf8(value: string): Buffer {
  return der(0x0c, Buffer.from(value, "utf8"));
}

function derOid(bytes: number[]): Buffer {
  return der(0x06, Buffer.from(bytes));
}

function derUtcTime(date: Date): Buffer {
  const two = (value: number) => String(value).padStart(2, "0");
  const value = `${two(date.getUTCFullYear() % 100)}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}Z`;
  return der(0x17, Buffer.from(value, "ascii"));
}

function makeSelfSignedCertificate(
  privateKey: string,
  publicKey: string,
): string {
  const commonNameOid = derOid([0x55, 0x04, 0x03]);
  const name = derSequence(
    derSet(derSequence(commonNameOid, derUtf8("Task 3D Runtime Test IdP"))),
  );
  const sha256WithRsa = derSequence(
    derOid([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]),
    der(0x05, Buffer.alloc(0)),
  );
  const validity = derSequence(
    derUtcTime(new Date(Date.now() - 60_000)),
    derUtcTime(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  );
  const spki = Buffer.from(
    createPublicKey(publicKey).export({
      format: "der",
      type: "spki",
    }),
  );
  const tbs = derSequence(
    der(0xa0, derInteger(2)),
    derInteger(1),
    sha256WithRsa,
    name,
    validity,
    name,
    spki,
  );
  const signature = signBytes("sha256", tbs, {
    key: privateKey,
    padding: constants.RSA_PKCS1_PADDING,
  });
  const certificate = derSequence(
    tbs,
    sha256WithRsa,
    der(0x03, Buffer.concat([Buffer.from([0]), signature])),
  );
  const base64 = certificate
    .toString("base64")
    .match(/.{1,64}/g)
    ?.join("\n");
  assert.ok(base64);
  return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;
}

function makeTestSaml(idpCert: string): SAML {
  return new SAML({
    entryPoint: "https://idp.example.test/sso",
    issuer: "test-sp",
    idpIssuer: TEST_IDP_ISSUER,
    idpCert,
    callbackUrl: `${TEST_APP_ORIGIN}/api/auth/sso/callback`,
    logoutUrl: "https://idp.example.test/slo",
    logoutCallbackUrl: TEST_SLS_DESTINATION,
    audience: false,
    acceptedClockSkewMs: 300_000,
    validateInResponseTo: ValidateInResponseTo.never,
  });
}

function makeLogoutRequestXml(
  options: {
    issueInstant?: string;
    destination?: string;
    issuer?: string;
    nameID?: string;
    nameIDFormat?: string;
    sessionIndexes?: string[];
    rootName?: string;
    namespace?: string;
    id?: string;
  } = {},
): string {
  const issueInstant = options.issueInstant ?? new Date().toISOString();
  const sessionIndexes = options.sessionIndexes ?? ["session-001"];
  const sessionXml = sessionIndexes
    .map((value) => `<samlp:SessionIndex>${value}</samlp:SessionIndex>`)
    .join("");
  const rootName = options.rootName ?? "LogoutRequest";
  const namespace = options.namespace ?? SAML_PROTOCOL_NS;
  return `<samlp:${rootName} xmlns:samlp="${namespace}" xmlns:saml="${SAML_ASSERTION_NS}" ID="${options.id ?? "_request-001"}" Version="2.0" IssueInstant="${issueInstant}" Destination="${options.destination ?? TEST_SLS_DESTINATION}"><saml:Issuer>${options.issuer ?? TEST_IDP_ISSUER}</saml:Issuer><saml:NameID Format="${options.nameIDFormat ?? SAML_PERSISTENT_NAME_ID_FORMAT}">${options.nameID ?? "BULOG-NAME-ID-001"}</saml:NameID>${sessionXml}</samlp:${rootName}>`;
}

function makeLogoutResponseXml(
  options: {
    issueInstant?: string;
    destination?: string;
    issuer?: string;
    inResponseTo?: string;
    rootName?: string;
    namespace?: string;
    duplicateIssuer?: boolean;
  } = {},
): string {
  const issueInstant = options.issueInstant ?? new Date().toISOString();
  const rootName = options.rootName ?? "LogoutResponse";
  const namespace = options.namespace ?? SAML_PROTOCOL_NS;
  const issuer = `<saml:Issuer>${options.issuer ?? TEST_IDP_ISSUER}</saml:Issuer>`;
  return `<samlp:${rootName} xmlns:samlp="${namespace}" xmlns:saml="${SAML_ASSERTION_NS}" ID="_response-001" Version="2.0" IssueInstant="${issueInstant}" Destination="${options.destination ?? TEST_SLS_DESTINATION}" InResponseTo="${options.inResponseTo ?? "_outbound-001"}">${issuer}${options.duplicateIssuer ? issuer : ""}<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status></samlp:${rootName}>`;
}

function makeSignedRedirectQuery(
  xml: string,
  privateKey: string,
  messageType: "SAMLRequest" | "SAMLResponse" = "SAMLRequest",
  relayState?: string,
): string {
  const compressed = deflateRawSync(Buffer.from(xml, "utf8")).toString(
    "base64",
  );
  const parts = [`${messageType}=${encodeURIComponent(compressed)}`];
  if (relayState !== undefined)
    parts.push(`RelayState=${encodeURIComponent(relayState)}`);
  parts.push(`SigAlg=${encodeURIComponent(RSA_SHA256_URI)}`);
  const signingInput = parts.join("&");
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  parts.push(
    `Signature=${encodeURIComponent(signer.sign(privateKey, "base64"))}`,
  );
  return parts.join("&");
}

function makeUnsignedRedirectQuery(
  xml: string,
  messageType: "SAMLRequest" | "SAMLResponse" = "SAMLResponse",
  relayState?: string,
): string {
  const compressed = deflateRawSync(Buffer.from(xml, "utf8")).toString("base64");
  return `${messageType}=${encodeURIComponent(compressed)}${relayState === undefined ? "" : `&RelayState=${encodeURIComponent(relayState)}`}`;
}

function makeSignedPostXml(
  xml: string,
  privateKey: string,
  certificate: string,
): string {
  const signature = new SignedXml({
    privateKey,
    publicCert: certificate,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
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

function makePostRequest(
  xmlBase64: string,
  options: {
    relayState?: string;
    contentType?: string;
    extraFields?: string;
    declaredLength?: string;
  } = {},
): Request {
  const fields = [`SAMLResponse=${encodeURIComponent(xmlBase64)}`];
  if (options.relayState !== undefined) {
    fields.push(`RelayState=${encodeURIComponent(options.relayState)}`);
  }
  if (options.extraFields) fields.push(options.extraFields);
  const body = fields.join("&");
  const headers = new Headers({
    "content-type":
      options.contentType ?? "application/x-www-form-urlencoded",
  });
  if (options.declaredLength !== undefined) {
    headers.set("content-length", options.declaredLength);
  }
  return new Request(`${TEST_APP_ORIGIN}/api/auth/sso/sls`, {
    method: "POST",
    headers,
    body,
  });
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    issuer: TEST_IDP_ISSUER,
    nameID: "BULOG-NAME-ID-001",
    nameIDFormat: SAML_PERSISTENT_NAME_ID_FORMAT,
    ...overrides,
  };
}

describe("SAML logout helpers", () => {
  const previousSecret = process.env.SSO_JWT_SECRET;
  const previousIssuer = process.env.SAML_IDP_ISSUER;
  const previousFormat = process.env.SAML_NAME_ID_FORMAT;

  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  function setup() {
    setEnv("SSO_JWT_SECRET", "test-secret-with-enough-entropy-123456");
    setEnv(
      "SAML_IDP_ISSUER",
      "https://sso-test.bulog.co.id/saml/saml2/idp/metadata.php",
    );
    setEnv("SAML_NAME_ID_FORMAT", SAML_PERSISTENT_NAME_ID_FORMAT);
  }

  function restore() {
    setEnv("SSO_JWT_SECRET", previousSecret);
    setEnv("SAML_IDP_ISSUER", previousIssuer);
    setEnv("SAML_NAME_ID_FORMAT", previousFormat);
    setEnv("NEXT_PUBLIC_APP_URL", previousAppUrl);
  }

  it("preserves persistent NameID and SessionIndex", () => {
    setup();

    try {
      assert.deepEqual(
        extractLogoutProfile(makeProfile({ sessionIndex: "session-001" })),
        {
          issuer: "https://sso-test.bulog.co.id/saml/saml2/idp/metadata.php",
          nameID: "BULOG-NAME-ID-001",
          nameIDFormat: SAML_PERSISTENT_NAME_ID_FORMAT,
          sessionIndex: "session-001",
        },
      );
    } finally {
      restore();
    }
  });

  it("renews a valid context, preserves SessionIndex, and caps expiry", () => {
    setup();

    try {
      const now = 1_700_000_000;
      const token = jwt.sign(
        {
          purpose: "saml-logout-context",
          nip: "NIP-001",
          issuer: "https://sso-test.bulog.co.id/saml/saml2/idp/metadata.php",
          nameID: "BULOG-NAME-ID-001",
          nameIDFormat: SAML_PERSISTENT_NAME_ID_FORMAT,
          sessionIndex: "session-001",
          exp: now + 300,
        },
        process.env.SSO_JWT_SECRET!,
        { algorithm: "HS256" },
      );

      const cappedAtJwt = renewLogoutContextToken({
        token,
        expectedNip: "NIP-001",
        authJwtExp: now + 900,
        nowEpochSeconds: now,
      });

      assert.ok(cappedAtJwt);
      assert.equal(cappedAtJwt.exp, now + 900);

      const claims = jwt.decode(cappedAtJwt.token);

      assert.equal(
        typeof claims === "object" && claims !== null ? claims.exp : undefined,
        now + 900,
      );
      assert.equal(
        typeof claims === "object" && claims !== null
          ? claims.sessionIndex
          : undefined,
        "session-001",
      );

      const cappedAtContextMaxAge = renewLogoutContextToken({
        token,
        expectedNip: "NIP-001",
        authJwtExp: now + 48 * 60 * 60,
        nowEpochSeconds: now,
      });

      assert.ok(cappedAtContextMaxAge);
      assert.equal(cappedAtContextMaxAge.exp, now + 24 * 60 * 60);
    } finally {
      restore();
    }
  });

  it("rejects contexts or Auth.js expiries at or within 60 seconds", () => {
    setup();

    try {
      const now = 1_700_000_000;
      const makeToken = (exp: number) =>
        jwt.sign(
          {
            purpose: "saml-logout-context",
            nip: "NIP-001",
            issuer: "https://sso-test.bulog.co.id/saml/saml2/idp/metadata.php",
            nameID: "BULOG-NAME-ID-001",
            nameIDFormat: SAML_PERSISTENT_NAME_ID_FORMAT,
            exp,
          },
          process.env.SSO_JWT_SECRET!,
          { algorithm: "HS256" },
        );

      for (const exp of [now, now + 60]) {
        assert.equal(
          renewLogoutContextToken({
            token: makeToken(exp),
            expectedNip: "NIP-001",
            authJwtExp: now + 900,
            nowEpochSeconds: now,
          }),
          null,
        );
      }

      const validContext = makeToken(now + 300);

      for (const authJwtExp of [now, now + 60]) {
        assert.equal(
          renewLogoutContextToken({
            token: validContext,
            expectedNip: "NIP-001",
            authJwtExp,
            nowEpochSeconds: now,
          }),
          null,
        );
      }
    } finally {
      restore();
    }
  });

  it("rejects a mismatched Employee NIP and invalid context claims", () => {
    setup();

    try {
      const now = 1_700_000_000;
      const claims = {
        purpose: "saml-logout-context",
        nip: "NIP-001",
        issuer: "https://sso-test.bulog.co.id/saml/saml2/idp/metadata.php",
        nameID: "BULOG-NAME-ID-001",
        nameIDFormat: SAML_PERSISTENT_NAME_ID_FORMAT,
        exp: now + 300,
      };
      const makeToken = (overrides: Record<string, unknown> = {}) =>
        jwt.sign({ ...claims, ...overrides }, process.env.SSO_JWT_SECRET!, {
          algorithm: "HS256",
        });

      assert.equal(
        renewLogoutContextToken({
          token: makeToken(),
          expectedNip: "DIFFERENT-NIP",
          authJwtExp: now + 900,
          nowEpochSeconds: now,
        }),
        null,
      );

      for (const overrides of [
        { purpose: "other-purpose" },
        { issuer: "https://attacker.example.test/idp" },
        { nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient" },
      ]) {
        assert.equal(
          renewLogoutContextToken({
            token: makeToken(overrides),
            expectedNip: "NIP-001",
            authJwtExp: now + 900,
            nowEpochSeconds: now,
          }),
          null,
        );
      }

      const validToken = makeToken();
      process.env.SSO_JWT_SECRET = "different-test-secret";

      assert.equal(
        renewLogoutContextToken({
          token: validToken,
          expectedNip: "NIP-001",
          authJwtExp: now + 900,
          nowEpochSeconds: now,
        }),
        null,
      );
    } finally {
      restore();
    }
  });

  it("omits missing SessionIndex", () => {
    setup();

    try {
      assert.equal(extractLogoutProfile(makeProfile()).sessionIndex, undefined);
    } finally {
      restore();
    }
  });

  it("rejects foreign issuer", () => {
    setup();

    try {
      assert.throws(() =>
        extractLogoutProfile(
          makeProfile({
            issuer: "https://attacker.example.test/idp",
          }),
        ),
      );
    } finally {
      restore();
    }
  });

  it("rejects missing or blank NameID", () => {
    setup();

    try {
      assert.throws(() => extractLogoutProfile(makeProfile({ nameID: "" })));

      assert.throws(() => extractLogoutProfile(makeProfile({ nameID: "   " })));
    } finally {
      restore();
    }
  });

  it("rejects email and transient NameID formats", () => {
    setup();

    try {
      assert.throws(() =>
        extractLogoutProfile(
          makeProfile({
            nameIDFormat:
              "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
          }),
        ),
      );

      assert.throws(() =>
        extractLogoutProfile(
          makeProfile({
            nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
          }),
        ),
      );
    } finally {
      restore();
    }
  });

  it("creates and verifies logout context", () => {
    setup();

    try {
      const token = createLogoutContextToken({
        nip: "NIP-001",
        profile: makeProfile({
          sessionIndex: "session-001",
        }),
      });

      const context = verifyLogoutContextToken(token);

      assert.equal(context.purpose, "saml-logout-context");
      assert.equal(context.nip, "NIP-001");
      assert.equal(context.nameID, "BULOG-NAME-ID-001");
      assert.equal(context.nameIDFormat, SAML_PERSISTENT_NAME_ID_FORMAT);
      assert.equal(context.sessionIndex, "session-001");
      assert.equal(typeof context.exp, "number");
    } finally {
      restore();
    }
  });

  it("rejects tampered, expired, wrong-purpose, and wrong-secret tokens", () => {
    setup();

    try {
      const token = createLogoutContextToken({
        nip: "NIP-001",
        profile: makeProfile(),
      });

      assert.throws(() => verifyLogoutContextToken(`${token}tampered`));

      const expired = jwt.sign(
        {
          purpose: "saml-logout-context",
          nip: "NIP-001",
          issuer: "https://sso-test.bulog.co.id/saml/saml2/idp/metadata.php",
          nameID: "BULOG-NAME-ID-001",
          nameIDFormat: SAML_PERSISTENT_NAME_ID_FORMAT,
          exp: Math.floor(Date.now() / 1000) - 1,
        },
        process.env.SSO_JWT_SECRET!,
        { algorithm: "HS256" },
      );

      assert.throws(() => verifyLogoutContextToken(expired));

      const wrongPurpose = jwt.sign(
        {
          purpose: "sso-callback",
          nip: "NIP-001",
          issuer: "https://sso-test.bulog.co.id/saml/saml2/idp/metadata.php",
          nameID: "BULOG-NAME-ID-001",
          nameIDFormat: SAML_PERSISTENT_NAME_ID_FORMAT,
          exp: Math.floor(Date.now() / 1000) + 60,
        },
        process.env.SSO_JWT_SECRET!,
        { algorithm: "HS256" },
      );

      assert.throws(() => verifyLogoutContextToken(wrongPurpose));

      setEnv("SSO_JWT_SECRET", "different-secret-with-enough-entropy-123456");

      assert.throws(() => verifyLogoutContextToken(token));
    } finally {
      restore();
    }
  });

  it("validates a real RSA-SHA256 Redirect LogoutRequest with the original raw query", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const certificate = makeSelfSignedCertificate(privateKey, publicKey);
    const validator = makeTestSaml(certificate);
    const rawQuery = makeSignedRedirectQuery(
      makeLogoutRequestXml(),
      privateKey,
      "SAMLRequest",
      "test-relay-state",
    );

    try {
      const message = await validateRedirectLogoutMessage(rawQuery, validator);
      assert.equal(message.messageType, "SAMLRequest");
      assert.equal(message.id, "_request-001");
      assert.equal(message.issuer, TEST_IDP_ISSUER);
      assert.equal(message.destination, TEST_SLS_DESTINATION);
      assert.equal(message.nameID, "BULOG-NAME-ID-001");
      assert.equal(message.nameIDFormat, SAML_PERSISTENT_NAME_ID_FORMAT);
      assert.equal(message.sessionIndex, "session-001");
      assert.equal(message.relayState, "test-relay-state");
    } finally {
      restore();
    }
  });

  it("validates a Redirect LogoutResponse using its query signature without requiring XMLDSIG", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const validator = makeTestSaml(
      makeSelfSignedCertificate(privateKey, publicKey),
    );
    const rawQuery = makeSignedRedirectQuery(
      makeLogoutResponseXml(),
      privateKey,
      "SAMLResponse",
      "logout-relay-state",
    );

    try {
      const message = await validateRedirectLogoutMessage(rawQuery, validator);
      assert.equal(message.messageType, "SAMLResponse");
      assert.equal(message.id, "_response-001");
      assert.equal(message.inResponseTo, "_outbound-001");
      assert.equal(message.relayState, "logout-relay-state");
    } finally {
      restore();
    }
  });

  it("accepts unsigned Redirect LogoutResponse semantics while rejecting unsigned requests and partial signatures", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    try {
      const unsigned = makeUnsignedRedirectQuery(
        makeLogoutResponseXml(),
        "SAMLResponse",
        "logout-relay-state",
      );
      const message = await validateRedirectLogoutMessage(unsigned);
      assert.equal(message.messageType, "SAMLResponse");
      assert.equal(message.inResponseTo, "_outbound-001");
      assert.equal(message.responseSuccess, true);
      assert.equal(message.relayState, "logout-relay-state");

      await assert.rejects(validateRedirectLogoutMessage(
        makeUnsignedRedirectQuery(makeLogoutRequestXml(), "SAMLRequest"),
      ));
      await assert.rejects(validateRedirectLogoutMessage(
        `${unsigned}&SigAlg=${encodeURIComponent(RSA_SHA256_URI)}`,
      ));
      await assert.rejects(validateRedirectLogoutMessage(
        `${unsigned}&Signature=AAAA`,
      ));
      await assert.rejects(validateRedirectLogoutMessage(
        makeUnsignedRedirectQuery(makeLogoutResponseXml({ issuer: "https://other-idp.test" })),
      ));
    } finally {
      restore();
    }
  });

  it("rejects unsigned, missing-signature-field, wrong-algorithm, and tampered Redirect requests", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const validator = makeTestSaml(
      makeSelfSignedCertificate(privateKey, publicKey),
    );
    const encoded = encodeURIComponent(
      deflateRawSync(Buffer.from(makeLogoutRequestXml())).toString("base64"),
    );
    const unsigned = `SAMLRequest=${encoded}`;
    const signed = makeSignedRedirectQuery(makeLogoutRequestXml(), privateKey);

    try {
      await assert.rejects(validateRedirectLogoutMessage(unsigned, validator));
      await assert.rejects(
        validateRedirectLogoutMessage(
          signed.replace(/&Signature=[^&]+$/, ""),
          validator,
        ),
      );
      await assert.rejects(
        validateRedirectLogoutMessage(
          signed.replace(/&SigAlg=[^&]+/, ""),
          validator,
        ),
      );
      await assert.rejects(
        validateRedirectLogoutMessage(
          signed.replace(
            encodeURIComponent(RSA_SHA256_URI),
            encodeURIComponent("http://www.w3.org/2000/09/xmldsig#rsa-sha1"),
          ),
          validator,
        ),
      );
      await assert.rejects(
        validateRedirectLogoutMessage(
          signed.replace(
            /Signature=([^&])/,
            (_match, character: string) =>
              `Signature=${character === "A" ? "B" : "A"}`,
          ),
          validator,
        ),
      );
    } finally {
      restore();
    }
  });

  it("rejects Redirect query duplicates, unknown keys, malformed escapes, empty segments, aliases, and noncanonical order", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const validator = makeTestSaml(
      makeSelfSignedCertificate(privateKey, publicKey),
    );
    const signed = makeSignedRedirectQuery(makeLogoutRequestXml(), privateKey);

    try {
      const message = deflateRawSync(Buffer.from(makeLogoutRequestXml())).toString(
        "base64",
      );
      const queryPrefix = `SAMLRequest=${encodeURIComponent(message)}&RelayState=`;
      const querySuffix = `&SigAlg=${encodeURIComponent(RSA_SHA256_URI)}&Signature=${"A".repeat(344)}`;
      const relayState = "A".repeat(
        16 * 1024 - Buffer.byteLength(queryPrefix + querySuffix),
      );
      const exactQuery = `${queryPrefix}${relayState}${querySuffix}`;
      assert.equal(Buffer.byteLength(exactQuery), 16 * 1024);
      const parserOnlyValidator: SamlLogoutValidator = {
        validateRedirectAsync: async () => ({
          loggedOut: true,
          profile: makeProfile({
            ID: "_request-001",
            sessionIndex: "session-001",
          }),
        }),
        validatePostResponseAsync: async () => ({
          loggedOut: true,
          profile: null,
        }),
      };
      const exactLimitMessage = await validateRedirectLogoutMessage(
        exactQuery,
        parserOnlyValidator,
      );
      assert.equal(exactLimitMessage.relayState, relayState);

      for (const malformed of [
        `${signed}&RelayState=duplicate`,
        `${signed}&Unknown=x`,
        `${signed}&`,
        signed.replace("SAMLRequest=", "%53AMLRequest="),
        signed.replace("SAMLRequest=", "SAMLRequest=%GG"),
        signed.replace(/SAMLRequest=[^&]+/, "SAMLRequest=%40%40%40%40"),
        signed.replace("&SigAlg=", "&Signature=duplicate&SigAlg="),
        makeSignedRedirectQuery(
          makeLogoutRequestXml(),
          privateKey,
          "SAMLRequest",
          "injectSigAlg=attacker",
        ),
        signed.split("&").reverse().join("&"),
      ]) {
        await assert.rejects(
          validateRedirectLogoutMessage(malformed, validator),
        );
      }
      await assert.rejects(
        validateRedirectLogoutMessage(
          `${signed}&RelayState=x`.padEnd(16 * 1024 + 1, "x"),
          validator,
        ),
      );
    } finally {
      restore();
    }
  });

  it("rejects Redirect inflate bombs and accepts bounded deflate output", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const validator = makeTestSaml(
      makeSelfSignedCertificate(privateKey, publicKey),
    );
    const bombXml = `<samlp:LogoutRequest xmlns:samlp="${SAML_PROTOCOL_NS}" xmlns:saml="${SAML_ASSERTION_NS}" ID="_bomb" Version="2.0" IssueInstant="${new Date().toISOString()}" Destination="${TEST_SLS_DESTINATION}"><saml:Issuer>${TEST_IDP_ISSUER}</saml:Issuer><saml:NameID Format="${SAML_PERSISTENT_NAME_ID_FORMAT}">N</saml:NameID>${" ".repeat(70 * 1024)}</samlp:LogoutRequest>`;
    const bomb = makeSignedRedirectQuery(bombXml, privateKey);

    try {
      await assert.rejects(validateRedirectLogoutMessage(bomb, validator));
      const baseXml = makeLogoutRequestXml({ sessionIndexes: [] });
      const closingTag = "</samlp:LogoutRequest>";
      const exactXml = `${baseXml.slice(0, -closingTag.length)}${" ".repeat(64 * 1024 - Buffer.byteLength(baseXml))}${closingTag}`;
      const exactCompressed = makeSignedRedirectQuery(exactXml, privateKey);
      assert.equal(Buffer.byteLength(exactXml), 64 * 1024);
      const withinLimitXml = makeLogoutRequestXml();
      const withinLimit = makeSignedRedirectQuery(withinLimitXml, privateKey);
      assert.equal(
        (await validateRedirectLogoutMessage(withinLimit, validator))
          .messageType,
        "SAMLRequest",
      );
      assert.equal(
        (await validateRedirectLogoutMessage(exactCompressed, validator))
          .messageType,
        "SAMLRequest",
      );
      const overLimitXml = `${exactXml.slice(0, -closingTag.length)} ${closingTag}`;
      await assert.rejects(
        validateRedirectLogoutMessage(
          makeSignedRedirectQuery(overLimitXml, privateKey),
          validator,
        ),
      );
    } finally {
      restore();
    }
  });

  it("enforces Redirect issuer, destination, issue time, persistent NameID, and SessionIndex semantics", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const validator = makeTestSaml(
      makeSelfSignedCertificate(privateKey, publicKey),
    );
    const now = Date.now();
    const variants = [
      makeLogoutRequestXml({ issuer: "https://attacker.example/idp" }),
      makeLogoutRequestXml({ destination: "https://attacker.example/sls" }),
      makeLogoutRequestXml({
        issueInstant: new Date(now - 301_000).toISOString(),
      }),
      makeLogoutRequestXml({
        issueInstant: new Date(now + 31_000).toISOString(),
      }),
      makeLogoutRequestXml({ issueInstant: "yesterday" }),
      makeLogoutRequestXml({ issueInstant: "2026-99-99T99:99:99Z" }),
      makeLogoutRequestXml({ issueInstant: "2026-02-31T12:00:00Z" }),
      makeLogoutRequestXml({ issueInstant: "2026-01-01T12:00:00+14:01" }),
      makeLogoutRequestXml({
        nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
      }),
      makeLogoutRequestXml({ sessionIndexes: ["one", "two"] }),
      makeLogoutRequestXml({ sessionIndexes: ["   "] }),
    ];

    try {
      for (const xml of variants) {
        await assert.rejects(
          validateRedirectLogoutMessage(
            makeSignedRedirectQuery(xml, privateKey),
            validator,
          ),
        );
      }
      const noSessionIndex = makeLogoutRequestXml({ sessionIndexes: [] });
      assert.equal(
        (
          await validateRedirectLogoutMessage(
            makeSignedRedirectQuery(noSessionIndex, privateKey),
            validator,
          )
        ).sessionIndex,
        undefined,
      );
      setEnv(
        "SAML_NAME_ID_FORMAT",
        "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
      );
      const transientRequest = makeLogoutRequestXml({
        nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
      });
      await assert.rejects(
        validateRedirectLogoutMessage(
          makeSignedRedirectQuery(transientRequest, privateKey),
          validator,
        ),
      );
    } finally {
      restore();
    }
  });

  it("validates an actually signed root POST LogoutResponse through Node-SAML", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const certificate = makeSelfSignedCertificate(privateKey, publicKey);
    const validator = makeTestSaml(certificate);
    const signedXml = makeSignedPostXml(
      makeLogoutResponseXml(),
      privateKey,
      certificate,
    );

    try {
      const response = await validatePostLogoutResponse(
        makePostRequest(Buffer.from(signedXml).toString("base64"), {
          relayState: "logout-relay-state",
        }),
        validator,
      );
      assert.equal(response.messageType, "SAMLResponse");
      assert.equal(response.id, "_response-001");
      assert.equal(response.inResponseTo, "_outbound-001");
      assert.equal(response.issuer, TEST_IDP_ISSUER);
      assert.equal(response.relayState, "logout-relay-state");
    } finally {
      restore();
    }
  });

  it("rejects unsigned, wrong-root, wrapped, and tampered POST LogoutResponses", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const certificate = makeSelfSignedCertificate(privateKey, publicKey);
    const validator = makeTestSaml(certificate);
    const unsignedXml = makeLogoutResponseXml();
    const wrongRootXml = makeLogoutResponseXml({ rootName: "LogoutRequest" });
    const wrappedXml = `<Wrapper>${makeLogoutResponseXml()}</Wrapper>`;
    const signedXml = makeSignedPostXml(unsignedXml, privateKey, certificate);
    const tamperedXml = signedXml.replace("_outbound-001", "_attacker-001");

    try {
      for (const xml of [
        unsignedXml,
        makeSignedPostXml(wrongRootXml, privateKey, certificate),
        makeSignedPostXml(wrappedXml, privateKey, certificate),
        tamperedXml,
      ]) {
        await assert.rejects(
          validatePostLogoutResponse(
            makePostRequest(Buffer.from(xml).toString("base64")),
            validator,
          ),
        );
      }
    } finally {
      restore();
    }
  });

  it("rejects POST media type, duplicate/unknown fields, and malformed URL encoding", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const certificate = makeSelfSignedCertificate(privateKey, publicKey);
    const validator = makeTestSaml(certificate);
    const signedXml = makeSignedPostXml(
      makeLogoutResponseXml(),
      privateKey,
      certificate,
    );
    const encoded = Buffer.from(signedXml).toString("base64");

    try {
      await assert.rejects(
        validatePostLogoutResponse(
          makePostRequest(encoded, {
            contentType: "application/x-www-form-urlencoded; charset=utf-8",
          }),
          validator,
        ),
      );
      await assert.rejects(
        validatePostLogoutResponse(
          makePostRequest(encoded, {
            extraFields: `SAMLResponse=${encodeURIComponent(encoded)}`,
          }),
          validator,
        ),
      );
      await assert.rejects(
        validatePostLogoutResponse(
          makePostRequest(encoded, { extraFields: "Unknown=value" }),
          validator,
        ),
      );
      await assert.rejects(
        validatePostLogoutResponse(
          {
            headers: new Headers({
              "content-type": "application/x-www-form-urlencoded",
              "content-length": "1",
            }),
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `SAMLResponse=${encodeURIComponent(encoded)}`,
                  ),
                );
                controller.close();
              },
            }),
          } as Request,
          validator,
        ),
      );
      const malformed = new Request(`${TEST_APP_ORIGIN}/api/auth/sso/sls`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `SAMLResponse=%GG${encoded}`,
      });
      await assert.rejects(
        validatePostLogoutResponse(malformed, validator),
        InvalidSamlLogoutResponsePostError,
      );
      const postLogoutRequest = new Request(
        `${TEST_APP_ORIGIN}/api/auth/sso/sls`,
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "SAMLRequest=well-formed-field",
        },
      );
      await assert.rejects(
        validatePostLogoutResponse(postLogoutRequest, validator),
        UnsupportedSamlLogoutRequestPostError,
      );
    } finally {
      restore();
    }
  });

  it("rejects POST length/body/base64/XML bounds and DOCTYPE/entity declarations", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const certificate = makeSelfSignedCertificate(privateKey, publicKey);
    const validator = makeTestSaml(certificate);
    const xml = makeSignedPostXml(
      makeLogoutResponseXml(),
      privateKey,
      certificate,
    );
    const encoded = Buffer.from(xml).toString("base64");
    const oversizedBase64 = "A".repeat(Math.ceil((64 * 1024 + 1) / 3) * 4);
    const noDoctype = makeLogoutResponseXml();

    try {
      const baseForm = `SAMLResponse=${encodeURIComponent(encoded)}&RelayState=`;
      const exactBody = `${baseForm}${"A".repeat(256 * 1024 - Buffer.byteLength(baseForm))}`;
      assert.equal(Buffer.byteLength(exactBody), 256 * 1024);
      const exactBodyRequest = new Request(
        `${TEST_APP_ORIGIN}/api/auth/sso/sls`,
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: exactBody,
        },
      );
      const exactBodyResult = await validatePostLogoutResponse(
        exactBodyRequest,
        validator,
      );
      assert.equal(
        exactBodyResult.relayState?.length,
        256 * 1024 - Buffer.byteLength(baseForm),
      );

      await assert.rejects(
        validatePostLogoutResponse(
          {
            headers: new Headers({
              "content-type": "application/x-www-form-urlencoded",
              "content-length": String(256 * 1024 + 1),
            }),
            body: null,
          } as Request,
          validator,
        ),
      );
      await assert.rejects(
        validatePostLogoutResponse(
          {
            headers: new Headers({
              "content-type": "application/x-www-form-urlencoded",
            }),
            body: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array(256 * 1024));
                controller.enqueue(new Uint8Array(1));
                controller.close();
              },
            }),
          } as Request,
          validator,
        ),
      );
      await assert.rejects(
        validatePostLogoutResponse(makePostRequest("not base64!"), validator),
      );
      await assert.rejects(
        validatePostLogoutResponse(
          makePostRequest(oversizedBase64),
          validator,
        ),
      );
      const withDoctype = `<!DOCTYPE x [<!ENTITY y "z">]>${noDoctype}`;
      await assert.rejects(
        validatePostLogoutResponse(
          makePostRequest(Buffer.from(withDoctype).toString("base64")),
          validator,
        ),
      );
      await assert.rejects(
        validatePostLogoutResponse(
          makePostRequest(
            Buffer.from("<" + " ".repeat(64 * 1024) + ">").toString("base64"),
          ),
          validator,
        ),
      );
    } finally {
      restore();
    }
  });

  it("rejects POST root/namespace/cardinality/issuer/destination/time violations", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const certificate = makeSelfSignedCertificate(privateKey, publicKey);
    const validator = makeTestSaml(certificate);
    const now = Date.now();
    const variants = [
      makeLogoutResponseXml({ rootName: "Response" }),
      makeLogoutResponseXml({ namespace: "urn:wrong" }),
      makeLogoutResponseXml({ issuer: "https://attacker.example/idp" }),
      makeLogoutResponseXml({ destination: "https://attacker.example/sls" }),
      makeLogoutResponseXml({
        issueInstant: new Date(now - 301_000).toISOString(),
      }),
      makeLogoutResponseXml({
        issueInstant: new Date(now + 31_000).toISOString(),
      }),
      makeLogoutResponseXml({ issueInstant: "yesterday" }),
      makeLogoutResponseXml({ issueInstant: "2026-99-99T99:99:99Z" }),
      makeLogoutResponseXml({ issueInstant: "2026-02-31T12:00:00Z" }),
      makeLogoutResponseXml({ issueInstant: "2026-01-01T12:00:00+14:01" }),
      makeLogoutResponseXml({ duplicateIssuer: true }),
    ];

    try {
      for (const xml of variants) {
        const signed = makeSignedPostXml(xml, privateKey, certificate);
        await assert.rejects(
          validatePostLogoutResponse(
            makePostRequest(Buffer.from(signed).toString("base64")),
            validator,
          ),
        );
      }
    } finally {
      restore();
    }
  });

  it("verifies the Redirect query signature before accepting a non-success response status", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const validator = makeTestSaml(
      makeSelfSignedCertificate(privateKey, publicKey),
    );
    const rawQuery = makeSignedRedirectQuery(
      makeLogoutResponseXml().replace("status:Success", "status:Responder"),
      privateKey,
      "SAMLResponse",
      "logout-relay-state",
    );

    try {
      const message = await validateRedirectLogoutMessage(rawQuery, validator);
      assert.equal(message.responseSuccess, false);
      assert.equal(message.relayState, "logout-relay-state");

      const tampered = rawQuery.replace(
        /Signature=([^&])/,
        (_whole, first: string) => `Signature=${first === "A" ? "B" : "A"}`,
      );
      await assert.rejects(validateRedirectLogoutMessage(tampered, validator));
    } finally {
      restore();
    }
  });

  it("accepts a verified non-success LogoutResponse for correlated terminal failure handling", async () => {
    setup();
    process.env.NEXT_PUBLIC_APP_URL = TEST_APP_ORIGIN;
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const certificate = makeSelfSignedCertificate(privateKey, publicKey);
    const validator = makeTestSaml(certificate);
    const xml = makeLogoutResponseXml().replace("status:Success", "status:Responder");

    try {
      const signed = makeSignedPostXml(xml, privateKey, certificate);
      const result = await validatePostLogoutResponse(
        makePostRequest(Buffer.from(signed).toString("base64")),
        validator,
      );
      assert.equal(result.responseSuccess, false);
    } finally {
      restore();
    }
  });

  it("claims a rejected logout context once and expires the hashed replay entry", () => {
    const now = Math.floor(Date.now() / 1000);
    const contextToken = `single-use-context-${randomUUID()}`;
    assert.equal(claimRejectedLogoutContextToken(contextToken, now + 2, now), "claimed");
    assert.equal(claimRejectedLogoutContextToken(contextToken, now + 2, now), "replay");
    assert.equal(claimRejectedLogoutContextToken(contextToken, now + 4, now + 2), "claimed");
  });
});
