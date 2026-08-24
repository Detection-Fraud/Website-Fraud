// src/lib/saml.ts
import { SAML } from "@node-saml/node-saml";

const isProd = process.env.NODE_ENV === "production";

/**
 * Format string base64 dari .env menjadi format X.509 PEM yang valid.
 * WAJIB ada — env var biasanya menyimpan cert tanpa header & line wrap,
 * dan node-saml butuh format PEM standar untuk parse sertifikat.
 */
function formatPemCertificate(rawCert: string): string {
  if (!rawCert || rawCert === "dummy") return "";
  const cleaned = rawCert
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
  const formatted = cleaned.match(/.{1,64}/g)?.join("\n");
  return `-----BEGIN CERTIFICATE-----\n${formatted}\n-----END CERTIFICATE-----`;
}

const rawCert = process.env.SAML_IDP_CERT || "";
const idpCert = formatPemCertificate(rawCert);

if (isProd) {
  const ssoJwtSecret = process.env.SSO_JWT_SECRET || "";

  if (!idpCert || idpCert.length < 100) {
    throw new Error(
      "[SAML Config Error] SAML_IDP_CERT belum di-set atau tidak valid setelah diformat.",
    );
  }

  if (
    ssoJwtSecret.length < 32 ||
    ssoJwtSecret.includes("CHANGE_ME_IN_PRODUCTION")
  ) {
    throw new Error(
      "[SSO Config Error] SSO_JWT_SECRET belum di-set dengan benar.\n" +
        "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
}

export const saml = new SAML({
  entryPoint: process.env.SAML_ENTRY_POINT || "",
  issuer: "aktivasi-budaya-app",
  callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/callback`,
  idpCert: idpCert || "placeholder-dev-cert",

  wantAssertionsSigned: isProd,
  wantAuthnResponseSigned: isProd,
  audience: isProd ? "aktivasi-budaya-app" : false,
  acceptedClockSkewMs: isProd ? 300_000 : -1,
});
