import { SAML } from "@node-saml/node-saml";

/**
 * Konfigurasi SAML Service Provider (SP).
 *
 * Catatan keamanan:
 * - wantAssertionsSigned & wantAuthnResponseSigned di-set false
 *   untuk development (karena certificate IdP belum tersedia).
 * - Di PRODUCTION, keduanya WAJIB diubah ke true + sertakan cert IdP.
 */

export const saml = new SAML({
  entryPoint: process.env.SAML_ENTRY_POINT || "",
  issuer: "aktivasi-budaya-app",
  callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/callback`,
  idpCert: process.env.SAML_IDP_CERT || "dummy",

  wantAssertionsSigned: false,
  wantAuthnResponseSigned: false,
  audience: false,
  acceptedClockSkewMs: -1,
});

if (process.env.NODE_ENV === "production") {
  const secret = process.env.SSO_JWT_SECRET || "";
  if (secret.length < 32 || secret.includes("CHANGE_ME_IN_PRODUCTION")) {
    throw new Error(
      "[SSO Config Error] SSO_JWT_SECRET belum di-set dengan benar. " +
        "Generate dengan: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
}
