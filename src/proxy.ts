import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export async function proxy(request: NextRequest) {
  return auth(request as any) as any;
}

export const config = {
  // `/login` TIDAK di-exclude agar callback `authorized` bisa redirect
  // user yang sudah login ke dashboard sesuai role-nya
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|assets).*)"],
};
