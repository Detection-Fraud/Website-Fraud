import { saml } from "@/lib/saml";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // CSRF STATE VALIDATION
    const formData = await request.formData();
    const relayState = formData.get("RelayState") as string;
    const storedState = request.cookies.get("sso_csrf_state")?.value;

    const isDev = process.env.NODE_ENV === "development";

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

    if (isDev) {
      try {
        const decodedXml = Buffer.from(samlResponse, "base64").toString("utf8");
        console.log("[SSO DEBUG] ====== RAW SAML RESPONSE XML ======");
        console.log(decodedXml);
        console.log("[SSO DEBUG] ====== END SAML RESPONSE XML ======");
      } catch (decodeErr) {
        console.error(
          "[SSO DEBUG] Gagal decode SAMLResponse base64:",
          decodeErr,
        );
      }
    }

    const { profile } = await saml.validatePostResponseAsync({
      SAMLResponse: samlResponse,
    });

    // STEP 4: EXTRACT NIP DARI SAML PROFILE

    if (isDev) {
      console.log(
        "[SSO DEBUG] Full SAML profile:",
        JSON.stringify(profile, null, 2),
      );
    }

    const nip =
      (profile as any)?.nip ||
      (profile as any)?.uid ||
      (profile as any)?.employeeID ||
      profile?.nameID;

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
      path: "/api/auth/sso",
    });

    // clear csrf state cookie
    response.cookies.set("sso_csrf_state", "", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 0,
      path: "/",
    });

    return response;

    // TIMING SAFE E
  } catch (error) {
    const err = error as Error;
    console.error("[SSO CALLBACK] ❌ SAML Validation FAILED!");
    console.error("[SSO CALLBACK] Error name:", err.name);
    console.error("[SSO CALLBACK] Error message:", err.message);
    console.error("[SSO CALLBACK] Error stack:", err.stack);

    // Berikan error code yang lebih spesifik berdasarkan pesan error
    let errorCode = "InvalidSAMLResponse";
    if (err.message?.includes("expired")) {
      errorCode = "SAMLAssertionExpired";
    } else if (err.message?.includes("signature")) {
      errorCode = "InvalidSignature";
    } else if (err.message?.includes("Audience")) {
      errorCode = "AudienceMismatch";
    }

    console.error("[SSO CALLBACK] → Redirecting with error code:", errorCode);
    // ======================== END TAMBAHAN ========================

    return redirectWithError(request, errorCode);
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
    secure: true,
    sameSite: "none",
    maxAge: 0,
    path: "/",
  });

  return response;
}

export const GET = POST;
