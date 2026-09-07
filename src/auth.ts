import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import jwt from "jsonwebtoken";
import { evaluateAuthPolicy } from "@/lib/auth-policy";
import { consumeCredential } from "@/lib/sso-token-store";

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

        if (!user || !user.password) return null;

        const authDecision = evaluateAuthPolicy({
          provider: "LOCAL",
          user: {
            role: user.role,
            authProvider: user.authProvider,
            isActive: user.isActive,
            unitId: user.unitId,
          },
        });

        if (!authDecision.allowed) return null;

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
        const credential =
          typeof credentials?.token === "string" ? credentials.token : null;
        if (!credential) return null;

        try {
          const decode = jwt.verify(credential, process.env.SSO_JWT_SECRET!);

          if (
            typeof decode !== "object" ||
            decode === null ||
            decode.purpose !== "sso-login" ||
            typeof decode.nip !== "string"
          ) {
            return null;
          }

          if (!consumeCredential(credential)) {
            return null;
          }

          const nip = decode.nip.trim();
          if (!nip) return null;

          const employee = await prisma.employee.findUnique({
            where: { nip },
            select: {
              jenjang: true,
              kodeStatpeg: true,
              statKepeg: true,
              isPresentInSource: true,
              unitId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  role: true,
                  authProvider: true,
                  isActive: true,
                  unitId: true,
                  passwordChangedAt: true,
                  unit: {
                    select: {
                      name: true,
                      type: true,
                      parent: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          const user = employee?.user;

          if (!employee || !user) return null;

          const authDecision = evaluateAuthPolicy({
            provider: "SSO",
            user: {
              role: user.role,
              authProvider: user.authProvider,
              isActive: user.isActive,
              unitId: user.unitId,
            },
            employee,
          });

          if (!authDecision.allowed) return null;

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
