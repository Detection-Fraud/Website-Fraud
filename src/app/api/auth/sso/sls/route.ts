import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saml } from "@/lib/saml";
import {
  InvalidSamlLogoutResponsePostError,
  UnsupportedSamlLogoutRequestPostError,
  validatePostLogoutResponse,
  validateRedirectLogoutMessage,
  verifyLogoutContextToken,
  type SamlLogoutMessage,
} from "@/lib/saml-logout";
import {
  getSamlLogoutContextCookieOptions,
  getSamlLogoutRelayStateCookieOptions,
  getRawCookieValues,
  getSsoBaseUrl,
  relayStateMatches,
  SAML_LOGOUT_CONTEXT_COOKIE,
  SAML_LOGOUT_RELAY_STATE_COOKIE,
  SAML_REJECTED_LOGOUT_RELAY_PREFIX,
} from "@/lib/saml-transport";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };
const REPLAY_TTL_MS = 6 * 60 * 1000;
const REPLAY_CAPACITY = 4096;

/** Process-local by design: deployment must retain the locked single-instance/sticky SLS routing assumption. */
export class BoundedInboundLogoutReplayStore {
  private readonly entries = new Map<string, number>();

  claim(id: string, now = Date.now()): "claimed" | "replay" | "full" {
    for (const [key, expiry] of this.entries) {
      if (expiry <= now) this.entries.delete(key);
    }
    if (this.entries.has(id)) return "replay";
    if (this.entries.size >= REPLAY_CAPACITY) return "full";
    this.entries.set(id, now + REPLAY_TTL_MS);
    return "claimed";
  }
}

const inboundReplay = new BoundedInboundLogoutReplayStore();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

function terminal(
  _request: Request,
  success: boolean,
  method: "GET" | "POST",
  correlatedRejectedFlow = false,
) {
  let response: NextResponse;
  try {
    const path = correlatedRejectedFlow
      ? `/login?error=SSOAccessRejected&logout=${success ? "success" : "failed"}`
      : `/login?logout=${success ? "success" : "failed"}`;
    response = NextResponse.redirect(
      `${getSsoBaseUrl()}${path}`,
      method === "POST" ? 303 : 302,
    );
  } catch {
    response = NextResponse.json(
      { error: "Logout tidak dapat diselesaikan" },
      {
        status: 500,
        headers: NO_STORE,
      },
    );
  }
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(
    SAML_LOGOUT_RELAY_STATE_COOKIE,
    "",
    getSamlLogoutRelayStateCookieOptions(0),
  );
  response.cookies.set(
    SAML_LOGOUT_CONTEXT_COOKIE,
    "",
    getSamlLogoutContextCookieOptions(0),
  );
  return response;
}

function rawQuery(request: Request): string {
  const question = request.url.indexOf("?");
  return question < 0 ? "" : request.url.slice(question + 1);
}

function isResponseAttempt(query: string): boolean {
  return query.split("&", 1)[0]?.startsWith("SAMLResponse=") ?? false;
}

function isRejectedLogoutFlow(request: Request): boolean {
  const relayCookies = getRawCookieValues(
    request,
    SAML_LOGOUT_RELAY_STATE_COOKIE,
  );
  return (
    relayCookies.length === 1 &&
    new RegExp(
      `^${SAML_REJECTED_LOGOUT_RELAY_PREFIX}[A-Za-z0-9_-]{43}$`,
    ).test(relayCookies[0])
  );
}

function matchesProfile(
  context: ReturnType<typeof verifyLogoutContextToken>,
  message: SamlLogoutMessage,
) {
  return (
    context.issuer === message.issuer &&
    context.nameID === message.nameID &&
    context.nameIDFormat === message.nameIDFormat &&
    context.nameIDFormat ===
      "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent" &&
    (context.sessionIndex ?? undefined) === message.sessionIndex
  );
}

function relayMatches(
  request: NextRequest,
  message: SamlLogoutMessage,
): boolean {
  const received = message.relayState;
  const stored = getRawCookieValues(request, SAML_LOGOUT_RELAY_STATE_COOKIE);
  return (
    typeof received === "string" &&
    stored.length === 1 &&
    stored[0] !== "" &&
    relayStateMatches(received, stored[0])
  );
}

async function finishResponse(
  request: NextRequest,
  message: SamlLogoutMessage,
  method: "GET" | "POST",
) {
  if (
    !message.inResponseTo ||
    message.inResponseTo.length > 256 ||
    message.issuer !== process.env.SAML_IDP_ISSUER?.trim() ||
    message.destination !== `${getSsoBaseUrl()}/api/auth/sso/sls` ||
    !relayMatches(request, message)
  ) {
    return terminal(request, false, method);
  }
  // BoundedSamlRequestCache.getAsync prunes expired entries. The following remove is atomic; only one concurrent callback can consume the live ID.
  const inResponseTo = message.inResponseTo;
  let outstanding: string | null = null;
  let consumed: string | null = null;
  try {
    outstanding = await saml.cacheProvider.getAsync(inResponseTo);
    if (outstanding === null) return terminal(request, false, method);
    consumed = await saml.cacheProvider.removeAsync(inResponseTo);
  } catch {
    return terminal(request, false, method);
  }
  const correlated = consumed === message.inResponseTo;
  return terminal(
    request,
    correlated && message.responseSuccess !== false,
    method,
    correlated && isRejectedLogoutFlow(request),
  );
}

export async function GET(request: NextRequest) {
  const query = rawQuery(request);
  let message: SamlLogoutMessage;
  try {
    message = await validateRedirectLogoutMessage(query);
  } catch {
    return isResponseAttempt(query)
      ? terminal(request, false, "GET")
      : errorResponse("Permintaan SAML tidak valid", 400);
  }

  if (message.messageType === "SAMLResponse")
    return finishResponse(request, message, "GET");
  if (message.id.length > 256)
    return errorResponse("Permintaan SAML tidak valid", 400);

  let session;
  try {
    session = await auth();
  } catch {
    return errorResponse("Sesi tidak dapat diperiksa", 500);
  }

  if (!session?.user?.id) return issueSuccessResponse(message);
  if (session.user.authProvider !== "SSO") return issueSuccessResponse(message);

  let currentUser;
  try {
    currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { authProvider: true, employee: { select: { nip: true } } },
    });
  } catch {
    return errorResponse("Identitas SSO tidak dapat diperiksa", 500);
  }
  if (
    currentUser?.authProvider !== "SSO" ||
    !currentUser.employee?.nip?.trim()
  ) {
    return errorResponse("Identitas SSO tidak valid", 403);
  }

  const contextCookies = getRawCookieValues(
    request,
    SAML_LOGOUT_CONTEXT_COOKIE,
  );
  if (contextCookies.length !== 1 || !contextCookies[0])
    return errorResponse("Konteks logout tidak valid", 403);
  let context;
  try {
    context = verifyLogoutContextToken(contextCookies[0]);
  } catch {
    return errorResponse("Konteks logout tidak valid", 403);
  }
  if (
    context.nip !== currentUser.employee.nip.trim() ||
    !matchesProfile(context, message)
  ) {
    return errorResponse("Konteks logout tidak sesuai", 403);
  }

  // No await occurs between claim and insertion, so duplicate requests in this process cannot both win.
  const claim = inboundReplay.claim(message.id);
  if (claim === "replay")
    return errorResponse("Permintaan SAML tidak valid", 400);
  if (claim === "full")
    return errorResponse("Logout sementara tidak tersedia", 503);

  try {
    // Auth.js signOut writes the session-cookie clears into the ambient Next cookies() store.
    // It does not return a Web Response whose headers can be copied here.
    await signOut({ redirect: false, redirectTo: "/login" });
  } catch {
    return errorResponse("Logout tidak dapat diselesaikan", 500);
  }

  try {
    const redirectUrl = await saml.getLogoutResponseUrlAsync(
      {
        issuer: context.issuer,
        nameID: context.nameID,
        nameIDFormat: context.nameIDFormat,
        ID: message.id,
        ...(context.sessionIndex ? { sessionIndex: context.sessionIndex } : {}),
      },
      message.relayState ?? "",
      {},
      true,
    );
    const response = NextResponse.redirect(redirectUrl, 302);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(
      SAML_LOGOUT_CONTEXT_COOKIE,
      "",
      getSamlLogoutContextCookieOptions(0),
    );
    return response;
  } catch {
    return terminal(request, false, "GET");
  }
}

async function issueSuccessResponse(message: SamlLogoutMessage) {
  const claim = inboundReplay.claim(message.id);
  if (claim === "replay")
    return errorResponse("Permintaan SAML tidak valid", 400);
  if (claim === "full")
    return errorResponse("Logout sementara tidak tersedia", 503);
  try {
    const url = await saml.getLogoutResponseUrlAsync(
      {
        issuer: message.issuer,
        nameID: message.nameID!,
        nameIDFormat: message.nameIDFormat!,
        ID: message.id,
        ...(message.sessionIndex ? { sessionIndex: message.sessionIndex } : {}),
      },
      message.relayState ?? "",
      {},
      true,
    );
    const response = NextResponse.redirect(url, 302);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return errorResponse("Logout IdP tidak dapat diselesaikan", 502);
  }
}

export async function POST(request: NextRequest) {
  let message: SamlLogoutMessage;
  try {
    message = await validatePostLogoutResponse(request);
  } catch (error) {
    if (error instanceof UnsupportedSamlLogoutRequestPostError) {
      return new NextResponse(null, {
        status: 405,
        headers: { Allow: "GET", ...NO_STORE },
      });
    }
    if (error instanceof InvalidSamlLogoutResponsePostError)
      return terminal(request, false, "POST");
    return errorResponse("Permintaan SAML tidak valid", 400);
  }
  return finishResponse(request, message, "POST");
}
