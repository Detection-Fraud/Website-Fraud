// auth.config.ts
import type { NextAuthConfig } from "next-auth";

const PUBLIC_ROUTES = ["/login"];

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

      if (isLoggedIn && nextUrl.pathname === "/login") {
        // Biar universal, arahin ke /dashboard (jangan langsung admin, karena kancab juga login di sini)
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      if (!isLoggedIn && !isPublicRoute) {
        return Response.redirect(new URL("/login", nextUrl));
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
        token.regionId = user.regionId || null;
        token.branchId = user.branchId || null;
        token.divisionId = user.divisionId || null;
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
        session.user.regionId = token.regionId as string | null;
        session.user.branchId = token.branchId as string | null;
        session.user.divisionId = token.divisionId as string | null;
      }
      return session;
    },
  },
};
