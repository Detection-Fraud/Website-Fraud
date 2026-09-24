This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## SSO ingress configuration

SSO initiation requires an explicit `Origin` or `Referer` matching
`NEXT_PUBLIC_APP_URL`. In production, configure `TRUSTED_INGRESS_IDENTITY_HEADER`
to the header that your authenticated ingress/WAF sets after stripping any
client-supplied copy (for example, `x-ingress-client-id`). Requests without
that ingress-attested identity are rejected; `x-forwarded-for` and `x-real-ip`
are never used as trusted SSO client identity headers.

Internal environments that cannot configure their reverse proxy may explicitly
set `SSO_ALLOW_UNTRUSTED_INGRESS=true`. In that mode only, SSO initiation falls
back to the existing forwarded-address rate-limit identity. Keep the flag unset
for public environments.

## SAML service provider metadata

`NEXT_PUBLIC_APP_URL` is the application origin used to form the service
provider endpoints:

- ACS: `${NEXT_PUBLIC_APP_URL}/api/auth/sso/callback` using HTTP-POST.
- SLS: `${NEXT_PUBLIC_APP_URL}/api/auth/sso/sls` using HTTP-Redirect only.

The SLS endpoint accepts inbound `SAMLRequest` through Redirect GET only.
Runtime POST support for `SAMLResponse` does not add a POST SLS binding to the
metadata.

Configure the BULOG test IdP endpoints and persistent NameID format as follows:

```env
SAML_SP_ENTITY_ID=aktivasi-budaya-app
SAML_IDP_ISSUER=https://sso-test.bulog.co.id/saml/saml2/idp/metadata.php
SAML_ENTRY_POINT=https://sso-test.bulog.co.id/saml/saml2/idp/SSOService.php
SAML_LOGOUT_URL=https://sso-test.bulog.co.id/saml/saml2/idp/SingleLogoutService.php
SAML_NAME_ID_FORMAT=urn:oasis:names:tc:SAML:2.0:nameid-format:persistent
SAML_IDP_CERT=<active IdP signing certificate>

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
```
