import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@generated/prisma/client";
import {
  correctParticipationSnapshots,
  type CorrectionDatabase,
  type ParticipationCorrectionInput,
} from "./participation-correction";

const categoryId = "22222222-2222-4222-8222-222222222222";
const unitId = "11111111-1111-4111-8111-111111111111";
const secondUnitId = "33333333-3333-4333-8333-333333333333";
const currentUpdatedAt = new Date("2026-09-02T00:00:00.000Z");

type TestRow = {
  id: string;
  unitId: string;
  headcount: number | null;
  participantCount: number | null;
  percentage: Prisma.Decimal | null;
  provenance: string;
  employeeSyncRunId: string | null;
  headcountCapturedAt: Date | null;
  unitNameSnapshot: string | null;
  parentUnitNameSnapshot: string | null;
  categoryNameSnapshot: string | null;
  updatedAt: Date;
};

type FakeTransaction = {
  $queryRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown[]>;
  participationData: {
    findMany: () => Promise<TestRow[]>;
    updateMany: (args: {
      where: { id: string; updatedAt?: Date };
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
  participationCorrectionAudit: {
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<{ id: string }>;
  };
};

function createRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    id: "participation-1",
    unitId,
    headcount: 100,
    participantCount: 80,
    percentage: new Prisma.Decimal("80.00"),
    provenance: "EMPLOYEE_SNAPSHOT",
    employeeSyncRunId: "sync-1",
    headcountCapturedAt: new Date("2026-09-01T00:00:00.000Z"),
    unitNameSnapshot: "Unit A",
    parentUnitNameSnapshot: "Kanwil A",
    categoryNameSnapshot: "Category A",
    updatedAt: currentUpdatedAt,
    ...overrides,
  };
}

function createInput(
  rows: ParticipationCorrectionInput["rows"],
): ParticipationCorrectionInput {
  return {
    categoryId,
    tw: 1,
    year: 2026,
    rows: rows.map((row) => ({
      expectedUpdatedAt: currentUpdatedAt.toISOString(),
      ...row,
    })),
    actorId: "admin-1",
    actorName: "Admin Test",
  };
}

function createInputWithoutExpectedUpdatedAt(
  rows: ParticipationCorrectionInput["rows"],
): ParticipationCorrectionInput {
  return {
    categoryId,
    tw: 1,
    year: 2026,
    rows,
    actorId: "admin-1",
    actorName: "Admin Test",
  };
}

function createFakeDatabase(initialRows: TestRow[]) {
  const state = initialRows.map((item) => ({ ...item }));
  const audits: Array<Record<string, unknown>> = [];
  const events: string[] = [];
  const locks: string[] = [];
  const transactionOptions: Array<unknown> = [];

  let auditSequence = 0;
  let failAuditAt: number | null = null;
  let failUpdateId: string | null = null;

  const database = {
    $transaction: async (
      callback: (tx: FakeTransaction) => Promise<unknown>,
      options?: { isolationLevel: Prisma.TransactionIsolationLevel },
    ) => {
      transactionOptions.push(options);

      const stateBefore = state.map((item) => ({ ...item }));
      const auditsBefore = audits.map((item) => ({ ...item }));
      const eventsBefore = [...events];

      try {
        return await callback({
          $queryRaw: async (
            _query: TemplateStringsArray,
            ...values: unknown[]
          ) => {
            const lockKey = String(values[0] ?? "");
            locks.push(lockKey);
            events.push(`lock:${lockKey}`);
            return [] as unknown[];
          },
          participationData: {
            findMany: async () => state,
            updateMany: async ({
              where,
              data,
            }: {
              where: { id: string; updatedAt?: Date };
              data: Record<string, unknown>;
            }) => {
              events.push(`update:${where.id}`);

              if (failUpdateId === where.id) {
                return { count: 0 };
              }

              const current = state.find(
                (candidate) =>
                  candidate.id === where.id &&
                  (!where.updatedAt ||
                    candidate.updatedAt.getTime() ===
                      where.updatedAt.getTime()),
              );

              if (!current) {
                return { count: 0 };
              }

              assert.deepEqual(Object.keys(data).sort(), [
                "participantCount",
                "percentage",
              ]);

              current.participantCount = data.participantCount as number;
              current.percentage = data.percentage as Prisma.Decimal;
              current.updatedAt = new Date("2026-09-03T00:00:00.000Z");

              return { count: 1 };
            },
          },
          participationCorrectionAudit: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
              auditSequence += 1;
              events.push(`audit:${data.participationDataId}`);

              if (auditSequence === failAuditAt) {
                throw new Error("audit failure");
              }

              const audit = {
                id: `audit-${auditSequence}`,
                ...data,
              };

              audits.push(audit);
              return { id: audit.id };
            },
          },
        });
      } catch (error) {
        state.splice(0, state.length, ...stateBefore);
        audits.splice(0, audits.length, ...auditsBefore);
        events.splice(0, events.length, ...eventsBefore);
        throw error;
      }
    },
  } as unknown as CorrectionDatabase;

  return {
    database,
    state,
    audits,
    events,
    locks,
    transactionOptions,
    setFailAuditAt(value: number | null) {
      failAuditAt = value;
    },
    setFailUpdateId(value: string | null) {
      failUpdateId = value;
    },
  };
}

describe("correctParticipationSnapshots", () => {
  it("menggunakan Serializable transaction", async () => {
    const fake = createFakeDatabase([createRow()]);

    await correctParticipationSnapshots(
      createInput([
        {
          unitId,
          participantCount: 90,
          overwrite: true,
          reason: "Koreksi data peserta",
        },
      ]),
      fake.database,
    );

    assert.deepEqual(fake.transactionOptions, [
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    ]);
  });

  it("mengoreksi participantCount dan menghitung persentase dari denominator beku", async () => {
    const fake = createFakeDatabase([
      createRow({
        headcount: 300,
        participantCount: 100,
        percentage: new Prisma.Decimal("33.33"),
      }),
    ]);

    const result = await correctParticipationSnapshots(
      createInput([
        {
          unitId,
          participantCount: 101,
          overwrite: true,
          reason: "Koreksi jumlah peserta",
        },
      ]),
      fake.database,
    );

    assert.equal(result[0].status, "UPDATED");
    assert.equal(result[0].participantCount, 101);
    assert.equal(result[0].percentage.toString(), "33.67");
    assert.equal(
      (fake.audits[0].newPercentage as Prisma.Decimal).toFixed(2),
      "33.67",
    );
  });

  it("menolak participantCount negatif", async () => {
    const fake = createFakeDatabase([createRow()]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: -1,
            overwrite: true,
            reason: "Jumlah peserta tidak valid",
          },
        ]),
        fake.database,
      ),
      { status: 400 },
    );
  });

  it("menolak participantCount melebihi headcount beku", async () => {
    const fake = createFakeDatabase([createRow()]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 101,
            overwrite: true,
            reason: "Jumlah peserta tidak valid",
          },
        ]),
        fake.database,
      ),
      { status: 400 },
    );

    assert.equal(fake.audits.length, 0);
  });

  it("menghasilkan Decimal 0.00 dan warning untuk 0/0", async () => {
    const fake = createFakeDatabase([
      createRow({
        headcount: 0,
        participantCount: 0,
        percentage: new Prisma.Decimal("0.00"),
      }),
    ]);

    const result = await correctParticipationSnapshots(
      createInput([
        {
          unitId,
          participantCount: 0,
          overwrite: false,
        },
      ]),
      fake.database,
    );

    assert.equal(result[0].percentage.toFixed(2), "0.00");
    assert.equal(result[0].warning, "ZERO_HEADCOUNT");
  });

  it("menolak perubahan tanpa konfirmasi overwrite", async () => {
    const fake = createFakeDatabase([createRow()]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 90,
            overwrite: false,
            reason: "Koreksi tanpa overwrite",
          },
        ]),
        fake.database,
      ),
      { status: 409 },
    );

    assert.equal(fake.audits.length, 0);
  });

  it("menolak perubahan dengan alasan kosong atau whitespace", async () => {
    const fake = createFakeDatabase([createRow()]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 90,
            overwrite: true,
            reason: "   ",
          },
        ]),
        fake.database,
      ),
      { status: 400 },
    );

    assert.equal(fake.audits.length, 0);
  });

  it("melewati nilai yang sama tanpa update atau audit", async () => {
    const fake = createFakeDatabase([createRow()]);

    const result = await correctParticipationSnapshots(
      createInput([
        {
          unitId,
          participantCount: 80,
          overwrite: false,
        },
      ]),
      fake.database,
    );

    assert.equal(result[0].status, "UNCHANGED");
    assert.equal(fake.audits.length, 0);
    assert.equal(fake.events.includes("update:participation-1"), false);
  });

  it("mempertahankan seluruh data snapshot yang dibekukan", async () => {
    const original = createRow();
    const fake = createFakeDatabase([original]);

    await correctParticipationSnapshots(
      createInput([
        {
          unitId,
          participantCount: 90,
          overwrite: true,
          reason: "Koreksi snapshot peserta",
        },
      ]),
      fake.database,
    );

    assert.equal(fake.state[0].headcount, 100);
    assert.equal(fake.state[0].employeeSyncRunId, "sync-1");
    assert.equal(
      fake.state[0].headcountCapturedAt?.toISOString(),
      "2026-09-01T00:00:00.000Z",
    );
    assert.equal(fake.state[0].provenance, "EMPLOYEE_SNAPSHOT");
    assert.equal(fake.state[0].unitNameSnapshot, "Unit A");
    assert.equal(fake.state[0].parentUnitNameSnapshot, "Kanwil A");
    assert.equal(fake.state[0].categoryNameSnapshot, "Category A");
  });

  it("menyimpan audit dengan nilai lama, baru, alasan, dan actor", async () => {
    const fake = createFakeDatabase([createRow()]);

    await correctParticipationSnapshots(
      createInput([
        {
          unitId,
          participantCount: 90,
          overwrite: true,
          reason: "  Verifikasi daftar hadir  ",
        },
      ]),
      fake.database,
    );

    assert.deepEqual(fake.audits[0], {
      id: "audit-1",
      participationDataId: "participation-1",
      previousParticipantCount: 80,
      newParticipantCount: 90,
      previousPercentage: new Prisma.Decimal("80.00"),
      newPercentage: new Prisma.Decimal("90.00"),
      reason: "Verifikasi daftar hadir",
      actorId: "admin-1",
      actorName: "Admin Test",
    });
  });

  it("membuat audit sebelum update ParticipationData", async () => {
    const fake = createFakeDatabase([createRow()]);

    await correctParticipationSnapshots(
      createInput([
        {
          unitId,
          participantCount: 90,
          overwrite: true,
          reason: "Urutan koreksi valid",
        },
      ]),
      fake.database,
    );

    assert.deepEqual(fake.events.slice(-2), [
      "audit:participation-1",
      "update:participation-1",
    ]);
  });

  it("mengunci beberapa canonical key secara terurut", async () => {
    const fake = createFakeDatabase([
      createRow(),
      createRow({
        id: "participation-2",
        unitId: secondUnitId,
        participantCount: 70,
        percentage: new Prisma.Decimal("70.00"),
      }),
    ]);

    await correctParticipationSnapshots(
      createInput([
        {
          unitId: secondUnitId,
          participantCount: 71,
          overwrite: true,
          reason: "Koreksi unit kedua",
        },
        {
          unitId,
          participantCount: 81,
          overwrite: true,
          reason: "Koreksi unit pertama",
        },
      ]),
      fake.database,
    );

    assert.deepEqual(fake.locks, [
      `participation-correction:${unitId}:${categoryId}:1:2026`,
      `participation-correction:${secondUnitId}:${categoryId}:1:2026`,
    ]);
  });

  it("menolak snapshot yang tidak ditemukan tanpa membuat row baru", async () => {
    const fake = createFakeDatabase([]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 10,
            overwrite: true,
            reason: "Snapshot tidak ditemukan",
          },
        ]),
        fake.database,
      ),
      { status: 409 },
    );

    assert.equal(fake.state.length, 0);
    assert.equal(fake.audits.length, 0);
  });

  it("menolak row LEGACY tanpa memakai data Employee saat ini", async () => {
    const fake = createFakeDatabase([
      createRow({
        provenance: "LEGACY",
        headcount: null,
        employeeSyncRunId: null,
      }),
    ]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 90,
            overwrite: true,
            reason: "Koreksi row legacy",
          },
        ]),
        fake.database,
      ),
      { status: 409 },
    );

    assert.equal(fake.state[0].headcount, null);
    assert.equal(fake.state[0].participantCount, 80);
    assert.equal(fake.audits.length, 0);
  });

  it("menolak frozen snapshot yang kehilangan denominator atau provenance", async () => {
    const fake = createFakeDatabase([
      createRow({
        headcount: null,
        employeeSyncRunId: null,
      }),
    ]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 90,
            overwrite: true,
            reason: "Snapshot tidak lengkap",
          },
        ]),
        fake.database,
      ),
      { status: 409 },
    );
  });

  it("menolak koreksi berubah tanpa expectedUpdatedAt", async () => {
    const fake = createFakeDatabase([createRow()]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInputWithoutExpectedUpdatedAt([
          {
            unitId,
            participantCount: 90,
            overwrite: true,
            reason: "Koreksi tanpa versi data",
          },
        ]),
        fake.database,
      ),
      { status: 400 },
    );

    assert.equal(fake.audits.length, 0);
    assert.equal(fake.state[0].participantCount, 80);
  });

  it("mengembalikan konflik untuk expectedUpdatedAt yang stale", async () => {
    const fake = createFakeDatabase([createRow()]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 90,
            overwrite: true,
            reason: "Koreksi versi lama",
            expectedUpdatedAt: "2026-09-02T00:00:01.000Z",
          },
        ]),
        fake.database,
      ),
      { status: 409 },
    );

    assert.equal(fake.audits.length, 0);
  });

  it("tidak meninggalkan audit ketika update optimistic guard gagal", async () => {
    const fake = createFakeDatabase([createRow()]);
    fake.setFailUpdateId("participation-1");

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 90,
            overwrite: true,
            reason: "Koreksi konflik versi",
            expectedUpdatedAt: currentUpdatedAt.toISOString(),
          },
        ]),
        fake.database,
      ),
      { status: 409 },
    );

    assert.equal(fake.audits.length, 0);
    assert.equal(fake.state[0].participantCount, 80);
  });

  it("membatalkan seluruh batch jika salah satu row invalid", async () => {
    const fake = createFakeDatabase([
      createRow(),
      createRow({
        id: "participation-2",
        unitId: secondUnitId,
        participantCount: 70,
        percentage: new Prisma.Decimal("70.00"),
      }),
    ]);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 81,
            overwrite: true,
            reason: "Koreksi pertama",
          },
          {
            unitId: secondUnitId,
            participantCount: 101,
            overwrite: true,
            reason: "Koreksi kedua invalid",
          },
        ]),
        fake.database,
      ),
      { status: 400 },
    );

    assert.equal(fake.state[0].participantCount, 80);
    assert.equal(fake.state[1].participantCount, 70);
    assert.equal(fake.audits.length, 0);
  });

  it("membatalkan seluruh batch jika pembuatan audit berikutnya gagal", async () => {
    const fake = createFakeDatabase([
      createRow(),
      createRow({
        id: "participation-2",
        unitId: secondUnitId,
        participantCount: 70,
        percentage: new Prisma.Decimal("70.00"),
      }),
    ]);
    fake.setFailAuditAt(2);

    await assert.rejects(
      correctParticipationSnapshots(
        createInput([
          {
            unitId,
            participantCount: 81,
            overwrite: true,
            reason: "Koreksi batch pertama",
          },
          {
            unitId: secondUnitId,
            participantCount: 71,
            overwrite: true,
            reason: "Koreksi batch kedua",
          },
        ]),
        fake.database,
      ),
    );

    assert.equal(fake.state[0].participantCount, 80);
    assert.equal(fake.state[1].participantCount, 70);
    assert.equal(fake.audits.length, 0);
  });
});
