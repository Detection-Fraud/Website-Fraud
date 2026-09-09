// auth.config.ts
import { getDashboardByRole } from "@/lib/routes";
import { evaluateAuthPolicy, type AuthProvider } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import type { NextAuthConfig } from "next-auth";

const PUBLIC_ROUTES = ["/login", "/login/admin", "/login/sso"];

// Map each role → path prefixes they're allowed to access
const ROLE_PREFIXES: Record<string, string[]> = {
  ADMIN: ["/admin"],
  PIC: ["/pic"],
  VIEWER: ["/viewer"],
};

// All role-specific prefixes (used to detect protected zones)
const ALL_ROLE_PREFIXES = Object.values(ROLE_PREFIXES).flat();

async function findCurrentPageUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      authProvider: true,
      isActive: true,
      unitId: true,
      passwordChangedAt: true,
      employee: {
        select: {
          jenjang: true,
          kodeStatpeg: true,
          statKepeg: true,
          isPresentInSource: true,
          unitId: true,
        },
      },
    },
  });
}

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
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user?.id;
      const isPublicRoute = PUBLIC_ROUTES.includes(nextUrl.pathname);
      const pathname = nextUrl.pathname;

      if (!isLoggedIn && !isPublicRoute) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      if (!isLoggedIn) return true;
      if (isPublicRoute && pathname !== "/login") return true;

      const sessionProvider = (auth.user as { authProvider?: unknown })
        .authProvider;
      if (sessionProvider !== "SSO" && sessionProvider !== "LOCAL") {
        return Response.redirect(new URL("/login", nextUrl));
      }

      let currentUser: Awaited<ReturnType<typeof findCurrentPageUser>>;
      try {
        currentUser = await findCurrentPageUser(auth.user.id);
      } catch {
        return Response.redirect(new URL("/login", nextUrl));
      }

      if (!currentUser) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      const decision = evaluateAuthPolicy({
        provider: sessionProvider as AuthProvider,
        user: {
          role: currentUser.role,
          authProvider: currentUser.authProvider,
          isActive: currentUser.isActive,
          unitId: currentUser.unitId,
        },
        employee: currentUser.employee,
      });

      if (!decision.allowed) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      const authProvider = currentUser.authProvider;
      const pwChangeAt = currentUser.passwordChangedAt;
      const isChangePasswordPage = pathname === "/settings/change-password";

      if (authProvider === "LOCAL" && !isChangePasswordPage) {
        if (!pwChangeAt) {
          return Response.redirect(
            new URL("/settings/change-password", nextUrl),
          );
        }

        const daySinceChange = Math.floor(
          (Date.now() - new Date(pwChangeAt).getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daySinceChange > 90) {
          return Response.redirect(
            new URL("/settings/change-password", nextUrl),
          );
        }
      }

      // 1) Logged-in user visiting /login or / → redirect to their dashboard
      if (pathname === "/login" || pathname === "/") {
        const role = currentUser.role;
        const dashboardPath = getDashboardByRole(role);
        return Response.redirect(new URL(dashboardPath, nextUrl));
      }

      // 2) Not logged in and not on a public route → send to /login
      // 3) Role-based route guard: block access to another role's routes
      if (isLoggedIn) {
        const role = currentUser.role;
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
        token.passwordChangedAt = user.passwordChangedAt || null;
        token.authProvider = user.authProvider || "LOCAL";
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
        session.user.passwordChangedAt = token.passwordChangedAt as
          | string
          | null;
        session.user.authProvider = token.authProvider as string;
      }
      return session;
    },
  },
};
