import { generateSamlServiceProviderMetadata } from "@/lib/saml";
import { NextResponse } from "next/server";

export async function GET() {
  const metadata = generateSamlServiceProviderMetadata();

  return new NextResponse(metadata, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": 'attachment; filename="sp-metadata.xml"',
    },
  });
}
