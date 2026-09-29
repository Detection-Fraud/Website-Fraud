import { Client } from "pg";

export type UatMirrorTarget = {
  host: string;
  database: string;
  mirrorCount: number;
};

export function expectedUatMirrorTarget(env: NodeJS.ProcessEnv): UatMirrorTarget {
  const host = env.UAT_DB_HOST?.trim() ?? "";
  const database = env.UAT_DB_NAME?.trim() ?? "";
  const mirrorCount = Number(env.UAT_MIRROR_COUNT);

  if (!host || !database || !Number.isSafeInteger(mirrorCount) || mirrorCount < 1) {
    throw new Error("Set UAT_DB_HOST, UAT_DB_NAME, and positive UAT_MIRROR_COUNT before UAT writes.");
  }

  return { host, database, mirrorCount };
}

export async function readUatMirrorTarget(connectionString: string): Promise<{
  host: string | null;
  database: string;
  mirrorCount: number;
}> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{
      host: string | null;
      database: string;
      mirror_count: string;
    }>(`
      SELECT host(inet_server_addr()) AS host,
             current_database() AS database,
             (SELECT count(*) FROM pentaho_stage.employee_mirror) AS mirror_count
    `);
    const row = result.rows[0];
    if (!row) throw new Error("Cannot read UAT database identity.");
    return {
      host: row.host,
      database: row.database,
      mirrorCount: Number(row.mirror_count),
    };
  } finally {
    await client.end();
  }
}

export function assertUatMirrorTarget(
  expected: UatMirrorTarget,
  actual: { host: string | null; database: string; mirrorCount: number },
): void {
  if (
    actual.host !== expected.host ||
    actual.database !== expected.database ||
    actual.mirrorCount !== expected.mirrorCount
  ) {
    throw new Error("Connected database identity or mirror count differs from the confirmed UAT target.");
  }
}
