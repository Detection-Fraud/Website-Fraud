"use client";

import { useSession } from "next-auth/react";

/**
 * Custom hook to get the current user's data from the session.
 *
 * Usage:
 *   const { user, isLoading, isAuthenticated } = useCurrentUser();
 *
 * Data tersedia langsung dari session JWT, tanpa perlu query DB lagi:
 *   - user.name, user.role, user.username
 *   - user.unitId, user.unitName, user.unitType
 *   - user.parentUnitId, user.parentUnitName
 */
export function useCurrentUser() {
  const { data: session, status } = useSession();

  return {
    user: session?.user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    session,
  };
}
