import { saml } from "@/lib/saml";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // CSRF STATE VALIDATION
    const formData = await request.formData();
    const relayState = formData.get("RelayState") as string;
    const storedState = request.cookies.get("sso_csrf_state")?.value;

    if (!relayState || !storedState) {
      console.error(
        "[SSO CALLBACK] CSRF state missing - relayState: ",
        !!relayState,
        "cookie:",
        !!storedState,
      );

      return redirectWithError(request, "CSRFValidationFailed");
    }

    const relayBuf = Buffer.from(relayState);
    const storedBuf = Buffer.from(storedState);

    if (relayBuf.length !== storedBuf.length) {
      console.error("[SSO CALLBACK] CSRF state length mismatch");
      return redirectWithError(request, "CSRFValidationFailed");
    }

    const crypto = await import("crypto");
    if (!crypto.timingSafeEqual(relayBuf, storedBuf)) {
      console.error(
        "[SSO CALLBACK] CSRF state content mismatch - possible CSRF attact",
      );
      return redirectWithError(request, "CSRFValidationFailed");
    }

    // PARSE & VALIDATE SAML Response

    const samlResponse = formData.get("SAMLResponse") as string;

    if (!samlResponse) {
      console.error("[SSO CALLBACK] SAMLResponse tidak ditemukan di form data");
      return redirectWithError(request, "InvalidSAMLResponse");
    }

    const { profile } = await saml.validatePostResponseAsync({
      SAMLResponse: samlResponse,
    });

    // STEP 4: EXTRACT NIP DARI SAML PROFILE

    if (process.env.NODE_ENV === "development") {
      console.log(
        "[SSO DEBUG] Full SAML profile:",
        JSON.stringify(profile, null, 2),
      );
    }

    const nip =
      profile?.nameID ||
      (profile as any)?.nip ||
      (profile as any)?.uid ||
      (profile as any)?.employeeID;

    if (!nip) {
      console.error(
        "[SSO Callback] NIP tidak ditemukan di SAML profile:",
        profile,
      );
      return redirectWithError(request, "MissingNIP");
    }

    // generate temporary jwt + set cookies

    const temporaryToken = jwt.sign(
      { nip: nip as string },
      process.env.SSO_JWT_SECRET!,
      { expiresIn: "1m" },
    );

    const redirectUrl = new URL("/login/sso", request.url);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set("sso_temp_token", temporaryToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60,
      path: "/login/sso",
    });

    // clear csrf state cookie
    response.cookies.set("sso_csrf_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;

    // TIMING SAFE E
  } catch (error) {
    console.error("[SSO CALLBACK] Error saat validate post response:", error);
    return redirectWithError(request, "InvalidSAMLResponse");
  }
}

// HELPER REDIRECT KE HALAMAN LOGIN DENGAN ERROR YANG BERBEDA
function redirectWithError(request: Request, errorCode: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/login?error=${errorCode}`, request.url),
  );

  // clean up csrf cookies on error
  response.cookies.set("sso_csrf_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}

export const GET = POST;
