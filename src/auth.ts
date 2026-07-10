import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import jwt from "jsonwebtoken";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
          include: {
            unit: {
              include: { parent: true },
            },
          },
        });

        // DEV: semua role bisa login via credentials untuk testing
        // PROD: hanya ADMIN yang boleh, PIC/VIEWER wajib SSO (kecuali dibypass)
        const isRoleAllowed =
          process.env.NODE_ENV === "development" ||
          process.env.ALLOW_PIC_LOGIN === "true" ||
          user?.role === "ADMIN";

        if (!user || !isRoleAllowed || !user.password) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isPasswordValid) return null;

        return {
          id: user.id,
          name: user.name,
          username: user.username as string,
          role: user.role,
          unitId: user.unitId || null,
          unitName: user.unit?.name || null,
          unitType: user.unit?.type || null,
          parentUnitId: user.unit?.parent?.id || null,
          parentUnitName: user.unit?.parent?.name || null,
          passwordChangedAt: user.passwordChangedAt?.toISOString() || null,
          authProvider: user.authProvider || "LOCAL",
        };
      },
    }),

    // PROVIDER 2 SSO SAML
    Credentials({
      id: "sso-login",
      name: "SSO Login",
      credentials: {
        token: { label: "Token", type: "text" },
      },

      async authorize(credentials) {
        if (!credentials.token) return null;

        try {
          const decode = jwt.verify(
            credentials.token as string,
            process.env.SSO_JWT_SECRET!,
          ) as { nip: string };

          const nip = decode.nip;
          if (!nip) return null;

          const user = await prisma.user.findFirst({
            where: {
              OR: [{ username: nip }, { samlNameId: nip }],
              role: "PIC",
            },
            include: {
              unit: {
                include: { parent: true },
              },
            },
          });

          if (!user) return null;

          if (!user.samlNameId) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                samlNameId: nip,
                authProvider: "SSO",
              },
            });
          }

          return {
            id: user.id,
            name: user.name,
            username: user.username as string,
            role: user.role,
            unitId: user.unitId || null,
            unitName: user.unit?.name || null,
            unitType: user.unit?.type || null,
            parentUnitId: user.unit?.parent?.id || null,
            parentUnitName: user.unit?.parent?.name || null,
            passwordChangedAt: user.passwordChangedAt?.toISOString() || null,
            authProvider: user.authProvider || "SSO",
          };
        } catch (error) {
          console.error("[SSO] Token verification failed: ", error);
          return null;
        }
      },
    }),
  ],
});
