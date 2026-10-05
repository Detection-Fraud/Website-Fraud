import { createHash } from "node:crypto";
import type { Prisma } from "@generated/prisma/client";

export type PicImportDatabaseIdentity = {
  databaseName: string;
  schemaName: string;
  serverAddress: string;
  serverPort: number;
};

export function fingerprintPicImportDatabase(identity: PicImportDatabaseIdentity): string {
  if (!identity.databaseName || !identity.schemaName || !identity.serverAddress ||
      !Number.isInteger(identity.serverPort) || identity.serverPort < 1 || identity.serverPort > 65535) {
    throw new Error("Identitas database tidak lengkap");
  }
  return createHash("sha256").update(JSON.stringify([
    identity.databaseName, identity.schemaName, identity.serverAddress, identity.serverPort,
  ])).digest("hex");
}

export async function readPicImportDatabaseTarget(db: Pick<Prisma.TransactionClient, "$queryRaw">) {
  const [identity] = await db.$queryRaw<PicImportDatabaseIdentity[]>`
    SELECT current_database()::text AS "databaseName", current_schema()::text AS "schemaName",
      host(inet_server_addr()) AS "serverAddress", inet_server_port() AS "serverPort"
  `;
  if (!identity) throw new Error("Identitas database tidak tersedia");
  return { identity, fingerprint: fingerprintPicImportDatabase(identity) };
}
