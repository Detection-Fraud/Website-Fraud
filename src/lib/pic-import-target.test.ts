import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "@generated/prisma/client";
import { fingerprintPicImportDatabase, readPicImportDatabaseTarget } from "./pic-import-target";

describe("PIC import target confirmation", () => {
  const identity = { databaseName: "fraud_test", schemaName: "public", serverAddress: "127.0.0.1", serverPort: 5432 };
  it("casts PostgreSQL name results to adapter-supported text when reading the target", async () => {
    const db = { $queryRaw: async (sql: TemplateStringsArray) => {
      assert.match(sql.join(""), /current_database\(\)::text/);
      assert.match(sql.join(""), /current_schema\(\)::text/);
      return [identity];
    } } as unknown as Pick<Prisma.TransactionClient, "$queryRaw">;
    assert.deepEqual(await readPicImportDatabaseTarget(db), {
      identity, fingerprint: fingerprintPicImportDatabase(identity),
    });
  });
  it("is stable and distinguishes database, schema and server targets", () => {
    const baseline = fingerprintPicImportDatabase(identity);
    assert.equal(baseline, fingerprintPicImportDatabase({ ...identity }));
    for (const different of [{ databaseName: "other" }, { schemaName: "other" },
      { serverAddress: "127.0.0.2" }, { serverPort: 5433 }]) {
      assert.notEqual(baseline, fingerprintPicImportDatabase({ ...identity, ...different }));
    }
  });
  it("fails closed for incomplete target identity", () => {
    assert.throws(() => fingerprintPicImportDatabase({ ...identity, serverAddress: "" }));
    assert.throws(() => fingerprintPicImportDatabase({ ...identity, serverPort: 0 }));
  });
});
