"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

/**
 * Wrapper around NextAuth's SessionProvider.
 * Place this in the root layout so `useSession()` / `useCurrentUser()` works everywhere.
 *
 * Menerima `session` dari server layout agar data tersedia langsung
 * tanpa perlu fetch client-side → dropdown user langsung muncul.
 */
export default function SessionProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
