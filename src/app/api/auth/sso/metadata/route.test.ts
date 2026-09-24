import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { before, beforeEach, describe, it } from "node:test";
import { DOMParser } from "@xmldom/xmldom";

const metadataNamespace = "urn:oasis:names:tc:SAML:2.0:metadata";
const signatureNamespace = "http://www.w3.org/2000/09/xmldsig#";
const postBinding = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";
const redirectBinding = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";
const persistentNameId = "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent";

// Synthetic self-signed P-256 test material only. Never use for deployment.
const testSpPrivateKey = [
  "-----BEGIN PRIVATE KEY-----",
  "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgW2WqqhqiED5w2KFF",
  "mjO2ugM55qu3ksy4QoKm8BcIL8ehRANCAAR/K8GWT5ZXAwqpo31yBKYSTzPGwPSS",
  "+oFIuNEnTN+XcubxofL25urwqTQrlH+teKOKi89fGFlTqf2SVO51GgRk",
  "-----END PRIVATE KEY-----",
].join("\n");

const testSpCertificate = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBKTCB0aADAgECAgEBMAoGCCqGSM49BAMCMB8xHTAbBgNVBAMMFFRhc2s0IFN5",
  "bnRoZXRpYyBUZXN0MB4XDTI2MDEwMTAwMDAwMFoXDTM2MDEwMTAwMDAwMFowHzEd",
  "MBsGA1UEAwwUVGFzazQgU3ludGhldGljIFRlc3QwWTATBgcqhkjOPQIBBggqhkjO",
  "PQMBBwNCAAR/K8GWT5ZXAwqpo31yBKYSTzPGwPSS+oFIuNEnTN+XcubxofL25urw",
  "qTQrlH+teKOKi89fGFlTqf2SVO51GgRkMAoGCCqGSM49BAMCA0cAMEQCIAeSFB1z",
  "33X9caj3AYB52Udf77Kt2HPFVZiFVrighZd5AiBrzTwCxjS2UlCMXbno6CQo7XgQ",
  "9Snr7XZpnQbmJVHk8w==",
  "-----END CERTIFICATE-----",
].join("\n");

let getMetadata: () => Promise<Response>;
let samlInstance: typeof import("@/lib/saml").saml;

before(async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  process.env.SAML_SP_ENTITY_ID = "aktivasi-budaya-app";
  process.env.SAML_IDP_ISSUER = "https://idp.example.test/metadata";
  process.env.SAML_ENTRY_POINT = "https://idp.example.test/sso";
  process.env.SAML_LOGOUT_URL = "https://idp.example.test/slo";
  process.env.SAML_NAME_ID_FORMAT = persistentNameId;
  process.env.SAML_IDP_CERT = "TEST_ONLY_IDP_CERTIFICATE";
  process.env.SAML_SP_PRIVATE_KEY = "";
  process.env.SAML_SP_CERT = "";

  const route = await import("./route");
  const samlModule = await import("@/lib/saml");

  getMetadata = route.GET;
  samlInstance = samlModule.saml;
});

beforeEach(() => {
  samlInstance.options.privateKey = undefined;
  samlInstance.options.publicCert = undefined;
});

type XmlDocument = ReturnType<DOMParser["parseFromString"]>;

function getMetadataElement(document: XmlDocument, localName: string) {
  const elements = document.getElementsByTagNameNS(
    metadataNamespace,
    localName,
  );

  assert.equal(elements.length, 1, "expected exactly one " + localName);
  return elements.item(0)!;
}

async function getMetadataDocument() {
  const response = await getMetadata();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/xml");
  assert.equal(
    response.headers.get("Content-Disposition"),
    'attachment; filename="sp-metadata.xml"',
  );

  const xml = await response.text();
  const document = new DOMParser().parseFromString(xml, "application/xml");

  return { document, xml };
}

describe("GET /api/auth/sso/metadata", () => {
  it("preserves exact entity ID, ACS, Redirect-only SLS, and persistent NameID", async () => {
    const { document } = await getMetadataDocument();
    const root = document.documentElement;

    assert.ok(root);
    assert.equal(root.getAttribute("entityID"), "aktivasi-budaya-app");

    const acs = getMetadataElement(document, "AssertionConsumerService");
    assert.equal(acs.getAttribute("Binding"), postBinding);
    assert.equal(
      acs.getAttribute("Location"),
      "https://app.example.test/api/auth/sso/callback",
    );

    const sls = getMetadataElement(document, "SingleLogoutService");
    assert.equal(sls.getAttribute("Binding"), redirectBinding);
    assert.equal(
      sls.getAttribute("Location"),
      "https://app.example.test/api/auth/sso/sls",
    );

    const nameIdFormat = getMetadataElement(document, "NameIDFormat");
    assert.equal(nameIdFormat.textContent, persistentNameId);
  });

  it("does not publish a public certificate without an SP private key", async () => {
    samlInstance.options.publicCert = "TEST_ONLY_UNPAIRED_SP_CERTIFICATE";

    const { document, xml } = await getMetadataDocument();

    assert.equal(
      document.getElementsByTagNameNS(metadataNamespace, "KeyDescriptor")
        .length,
      0,
    );
    assert.equal(xml.includes("TEST_ONLY_UNPAIRED_SP_CERTIFICATE"), false);
    assert.equal(xml.includes("TEST_ONLY_IDP_CERTIFICATE"), false);
  });

  it("publishes the matching SP certificate and never publishes private or IdP material", async () => {
    samlInstance.options.privateKey = testSpPrivateKey;
    samlInstance.options.publicCert = testSpCertificate;

    const { document, xml } = await getMetadataDocument();
    const keyDescriptors = document.getElementsByTagNameNS(
      metadataNamespace,
      "KeyDescriptor",
    );
    const certificateElements = document.getElementsByTagNameNS(
      signatureNamespace,
      "X509Certificate",
    );

    assert.equal(keyDescriptors.length, 1);
    assert.equal(keyDescriptors.item(0)?.getAttribute("use"), "signing");
    assert.equal(certificateElements.length, 1);
    assert.equal(
      certificateElements.item(0)?.textContent?.replace(/\s+/g, ""),
      testSpCertificate.replace(
        /-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g,
        "",
      ),
    );
    assert.equal(xml.includes("TEST_ONLY_IDP_CERTIFICATE"), false);
    assert.equal(xml.includes("BEGIN PRIVATE KEY"), false);
    assert.equal(xml.includes("MIGHAgEAMBMGByqGSM49"), false);
  });

  it("rejects a public certificate that does not match the configured private key", async () => {
    const { privateKey: mismatchedPrivateKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
    });

    samlInstance.options.privateKey = mismatchedPrivateKey;
    samlInstance.options.publicCert = testSpCertificate;

    await assert.rejects(
      getMetadata(),
      /SAML_SP_CERT must match SAML_SP_PRIVATE_KEY/,
    );
  });
});
