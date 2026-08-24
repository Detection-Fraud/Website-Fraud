import { authConfig } from "@/auth.config";
import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { checkRateLimit, rateLimitResponse } from "./lib/api/rate-limit";

const { auth } = NextAuth(authConfig);

export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/api/auth/callback/credentials" &&
    request.method === "POST"
  ) {
    const rl = checkRateLimit(request, {
      keyPrefix: "login",
      max: 10,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return rateLimitResponse(rl.resetAt);
    }
  }
  return auth(request as any) as any;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|assets|uploads).*)"],
};
