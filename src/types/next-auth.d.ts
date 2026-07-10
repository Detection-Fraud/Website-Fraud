import { DefaultSession, DefaultUser } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      username: string;
      name: string;
      unitId: string | null;
      unitName: string | null;
      unitType: string | null;
      parentUnitId: string | null;
      parentUnitName: string | null;
      passwordChangedAt: string | null;
      authProvider: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    username: string;
    unitId: string | null;
    unitName: string | null;
    unitType: string | null;
    parentUnitId: string | null;
    parentUnitName: string | null;
    passwordChangedAt: string | null;
    authProvider: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    username: string;
    name: string;
    unitId: string | null;
    unitName: string | null;
    unitType: string | null;
    parentUnitId: string | null;
    parentUnitName: string | null;
    passwordChangedAt: string | null;
    authProvider: string | null;
  }
}
