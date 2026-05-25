// auth.config.ts
import type { NextAuthConfig } from "next-auth";
import { getDashboardByRole } from "@/lib/routes";

const PUBLIC_ROUTES = ["/login"];

// Map each role → path prefixes they're allowed to access
const ROLE_PREFIXES: Record<string, string[]> = {
  ADMIN: ["/admin"],
  PIC: ["/pic"],
  VIEWER: ["/viewer"],
};

// All role-specific prefixes (used to detect protected zones)
const ALL_ROLE_PREFIXES = Object.values(ROLE_PREFIXES).flat();

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
    updateAge: 60 * 60,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublicRoute = PUBLIC_ROUTES.includes(nextUrl.pathname);
      const pathname = nextUrl.pathname;

      // 1) Logged-in user visiting /login or / → redirect to their dashboard
      if (isLoggedIn && (pathname === "/login" || pathname === "/")) {
        const role = auth?.user?.role as string;
        const dashboardPath = getDashboardByRole(role);
        return Response.redirect(new URL(dashboardPath, nextUrl));
      }

      // 2) Not logged in and not on a public route → send to /login
      if (!isLoggedIn && !isPublicRoute) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      // 3) Role-based route guard: block access to another role's routes
      if (isLoggedIn) {
        const role = auth?.user?.role as string;
        const allowedPrefixes = ROLE_PREFIXES[role] || [];

        // Check if the path falls under any role-specific prefix
        const isRoleRoute = ALL_ROLE_PREFIXES.some((prefix) =>
          pathname.startsWith(prefix),
        );

        if (isRoleRoute) {
          // User is accessing a role-specific route — is it theirs?
          const isAllowed = allowedPrefixes.some((prefix) =>
            pathname.startsWith(prefix),
          );

          if (!isAllowed) {
            // Not their route → redirect to their own dashboard
            const dashboardPath = getDashboardByRole(role);
            return Response.redirect(new URL(dashboardPath, nextUrl));
          }
        }
      }

      return true;
    },

    // MENANGKAP DATA DARI AUTHORIZE -> MASUKIN KE TOKEN
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as string;
        token.username = user.username as string;
        token.name = user.name as string;
        token.unitId = user.unitId || null;
        token.unitName = user.unitName || null;
        token.unitType = user.unitType || null;
        token.parentUnitId = user.parentUnitId || null;
        token.parentUnitName = user.parentUnitName || null;
      }
      return token;
    },

    // MENERUSKAN DATA DARI TOKEN -> MASUKIN KE SESSION (Biar bisa dibaca UI)
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        session.user.name = token.name as string;
        session.user.unitId = token.unitId as string | null;
        session.user.unitName = token.unitName as string | null;
        session.user.unitType = token.unitType as string | null;
        session.user.parentUnitId = token.parentUnitId as string | null;
        session.user.parentUnitName = token.parentUnitName as string | null;
      }
      return session;
    },
  },
};
