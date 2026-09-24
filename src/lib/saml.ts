import {
  X509Certificate,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";
import { SAML, ValidateInResponseTo } from "@node-saml/node-saml";
import { getSsoBaseUrl } from "./saml-transport";
import { BoundedSamlRequestCache } from "./saml-request-cache";

const isProd = process.env.NODE_ENV === "production";

const DEFAULT_SP_ENTITY_ID = "aktivasi-budaya-app";

export const DEFAULT_SAML_NAME_ID_FORMAT =
  "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent";

export const SAML_IDP_ISSUER = process.env.SAML_IDP_ISSUER?.trim() || "";

export const SAML_NAME_ID_FORMAT =
  process.env.SAML_NAME_ID_FORMAT?.trim() || DEFAULT_SAML_NAME_ID_FORMAT;

function formatPemCertificate(rawCert: string): string {
  const value = rawCert.trim();

  if (!value || value === "dummy") return "";

  if (value.includes("-----BEGIN CERTIFICATE-----")) {
    return value.replace(/\\n/g, "\n");
  }

  const cleaned = value
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  const formatted = cleaned.match(/.{1,64}/g)?.join("\n");

  if (!formatted) return "";

  return `-----BEGIN CERTIFICATE-----\n${formatted}\n-----END CERTIFICATE-----`;
}

function formatPemPrivateKey(rawKey: string): string {
  const value = rawKey.trim();

  if (!value) return "";

  if (value.includes("-----BEGIN ")) {
    return value.replace(/\\n/g, "\n");
  }

  const cleaned = value
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const formatted = cleaned.match(/.{1,64}/g)?.join("\n");

  if (!formatted) return "";

  return `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----`;
}

function getMatchingSpPublicCertificate(
  privateKeyPem: string | Buffer,
  certificatePem: string,
): string {
  let isMatch = false;

  try {
    const derivedPublicKey = createPublicKey(
      createPrivateKey(privateKeyPem),
    ).export({
      type: "spki",
      format: "der",
    });
    const certificatePublicKey = new X509Certificate(
      certificatePem,
    ).publicKey.export({
      type: "spki",
      format: "der",
    });

    isMatch = derivedPublicKey.equals(certificatePublicKey);
  } catch {
    isMatch = false;
  }

  if (!isMatch) {
    throw new Error(
      "[SAML Config Error] SAML_SP_CERT must match SAML_SP_PRIVATE_KEY.",
    );
  }

  return certificatePem;
}

function requireHttpsUrl(name: string, value: string): void {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error(`[SAML Config Error] ${name} must be a valid HTTPS URL`);
  }
}

const spEntityId =
  process.env.SAML_SP_ENTITY_ID?.trim() || DEFAULT_SP_ENTITY_ID;

const entryPoint = process.env.SAML_ENTRY_POINT?.trim() || "";

const logoutUrl =
  process.env.SAML_LOGOUT_URL?.trim() || (isProd ? "" : entryPoint);

const idpCert = formatPemCertificate(process.env.SAML_IDP_CERT || "");

const spPrivateKey = formatPemPrivateKey(process.env.SAML_SP_PRIVATE_KEY || "");

const spPublicCert = formatPemCertificate(process.env.SAML_SP_CERT || "");

if (Boolean(spPrivateKey) !== Boolean(spPublicCert)) {
  throw new Error(
    "[SAML Config Error] SAML_SP_PRIVATE_KEY and SAML_SP_CERT must be configured together.",
  );
}

const samlRequestCache = new BoundedSamlRequestCache({
  capacity: 1024,
  keyExpirationPeriodMs: 5 * 60 * 1000,
});

const ssoBaseUrl = getSsoBaseUrl();

if (isProd) {
  const ssoJwtSecret = process.env.SSO_JWT_SECRET || "";

  if (!idpCert || idpCert.length < 100) {
    throw new Error("[SAML Config Error] SAML_IDP_CERT is missing or invalid.");
  }

  try {
    const certificate = new X509Certificate(idpCert);

    if (Date.parse(certificate.validTo) <= Date.now()) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "[SAML Config Error] SAML_IDP_CERT must be a valid active X.509 certificate.",
    );
  }

  if (
    ssoJwtSecret.length < 32 ||
    ssoJwtSecret.includes("CHANGE_ME_IN_PRODUCTION")
  ) {
    throw new Error("[SSO Config Error] SSO_JWT_SECRET is invalid.");
  }

  if (!entryPoint || !logoutUrl || !SAML_IDP_ISSUER) {
    throw new Error(
      "[SAML Config Error] SAML_ENTRY_POINT, SAML_LOGOUT_URL, and SAML_IDP_ISSUER are required.",
    );
  }

  requireHttpsUrl("SAML_ENTRY_POINT", entryPoint);
  requireHttpsUrl("SAML_LOGOUT_URL", logoutUrl);
  requireHttpsUrl("SAML_IDP_ISSUER", SAML_IDP_ISSUER);
}

const optionalSigningOptions =
  spPrivateKey && spPublicCert
    ? {
        privateKey: spPrivateKey,
        publicCert: spPublicCert,
        signatureAlgorithm: "sha256" as const,
      }
    : {};

export const saml = new SAML({
  entryPoint,
  issuer: spEntityId,
  idpIssuer: SAML_IDP_ISSUER || undefined,
  callbackUrl: `${ssoBaseUrl}/api/auth/sso/callback`,
  logoutUrl,
  logoutCallbackUrl: `${ssoBaseUrl}/api/auth/sso/sls`,
  identifierFormat: SAML_NAME_ID_FORMAT,
  idpCert: idpCert || "placeholder-dev-cert",

  ...optionalSigningOptions,

  wantAssertionsSigned: isProd,
  wantAuthnResponseSigned: false,
  audience: isProd ? spEntityId : false,
  acceptedClockSkewMs: isProd ? 300_000 : -1,

  validateInResponseTo: ValidateInResponseTo.always,
  cacheProvider: samlRequestCache,
  requestIdExpirationPeriodMs: 5 * 60 * 1000,
  maxAssertionAgeMs: 5 * 60 * 1000,
});

export function generateSamlServiceProviderMetadata(): string {
  const publicSigningCertificate =
    saml.options.privateKey && saml.options.publicCert
      ? getMatchingSpPublicCertificate(
          saml.options.privateKey,
          saml.options.publicCert,
        )
      : null;

  const metadata = saml.generateServiceProviderMetadata(
    null,
    publicSigningCertificate,
  );
  const singleLogoutServices =
    metadata.match(/<SingleLogoutService\b[^>]*\/>/g) ?? [];
  const postBinding =
    'Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"';
  const redirectBinding =
    'Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"';

  if (
    singleLogoutServices.length !== 1 ||
    !singleLogoutServices[0].includes(postBinding)
  ) {
    throw new Error(
      "[SAML Config Error] Unable to generate Redirect-only SLS metadata.",
    );
  }

  const redirectService = singleLogoutServices[0].replace(
    postBinding,
    redirectBinding,
  );

  return metadata.replace(singleLogoutServices[0], redirectService);
}
