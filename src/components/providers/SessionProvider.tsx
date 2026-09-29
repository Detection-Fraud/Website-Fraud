"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  SessionProvider as NextAuthSessionProvider,
  useSession,
} from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { api } from "@/lib/api";

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
      <SsoLogoutContextRefresh />
      {children}
    </NextAuthSessionProvider>
  );
}

function SsoLogoutContextRefresh() {
  const { data, status } = useSession();
  const requestedExpiries = useRef(new Set<string>());
  const refreshMutation = useMutation({
    mutationFn: () => api.post("/auth/sso/logout/context/refresh"),
  });

  useEffect(() => {
    const expiry = data?.expires;
    if (
      status !== "authenticated" ||
      data?.user?.authProvider !== "SSO" ||
      typeof expiry !== "string" ||
      !Number.isFinite(Date.parse(expiry)) ||
      Date.parse(expiry) <= Date.now() ||
      requestedExpiries.current.has(expiry)
    ) {
      return;
    }

    requestedExpiries.current.add(expiry);
    refreshMutation.mutate();
  }, [data?.expires, data?.user?.authProvider, refreshMutation, status]);

  return null;
}
