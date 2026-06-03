// Bisa dijadikan API route: src/app/api/auth/sso/metadata/route.ts
import { saml } from "@/lib/saml";
import { NextResponse } from "next/server";

export async function GET() {
  // Parameter 1: SP decryption certificate (null jika tidak ada)
  // Parameter 2: SP signing certificate (null jika tidak ada)
  const metadata = saml.generateServiceProviderMetadata(null, null);

  return new NextResponse(metadata, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": 'attachment; filename="sp-metadata.xml"',
    },
  });
}
