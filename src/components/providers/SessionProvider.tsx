"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Wrapper around NextAuth's SessionProvider.
 * Place this in the root layout so `useSession()` / `useCurrentUser()` works everywhere.
 */
export default function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
