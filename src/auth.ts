import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

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
        };
      },
    }),
  ],
});
