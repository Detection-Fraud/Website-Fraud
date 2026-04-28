import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      username: string;
      name: string;
      regionId: string | null;
      branchId: string | null;
      divisionId: string | null;
      regionName: string | null;
      branchName: string | null;
      divisionName: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    username: string;
    regionId: string | null;
    branchId: string | null;
    divisionId: string | null;
    regionName: string | null;
    branchName: string | null;
    divisionName: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    username: string;
    name: string;
    regionId: string | null;
    branchId: string | null;
    divisionId: string | null;
    regionName: string | null;
    branchName: string | null;
    divisionName: string | null;
  }
}
