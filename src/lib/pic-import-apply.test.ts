import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma, type PrismaClient } from "@generated/prisma/client";
import { applyPicImportAssignments, planPicImport, type PicImportEmployeeSnapshot, type PicImportAccountSnapshot } from "./pic-import";
import { fingerprintPicImportDatabase } from "./pic-import-target";

const input = [{ rowNumber: 6, nip: "00123", unitName: "Kantor Wilayah Aceh" }];
const employee: PicImportEmployeeSnapshot = { id: "employee-1", nip: "00123", name: "Candidate",
  unitId: "unit-1", unit: { id: "unit-1", name: "Kantor Wilayah Aceh" }, jenjang: "5", kodeStatpeg: "01",
  statKepeg: "02", isPresentInSource: true };
const identity = { databaseName: "fraud_test", schemaName: "public", serverAddress: "127.0.0.1", serverPort: 5432 };
const confirmation = { adminUserId: "admin-1", targetFingerprint: fingerprintPicImportDatabase(identity) };
function database(options: { employees?: PicImportEmployeeSnapshot[]; accounts?: PicImportAccountSnapshot[];
  failOnCreate?: number; adminRole?: string; adminActive?: boolean; adminProvider?: string } = {}) {
  const calls = { creates: 0, attempts: 0, options: undefined as unknown, transactions: 0,
    data: undefined as Prisma.UserCreateArgs["data"] | undefined };
  const tx = {
    $queryRaw: async () => [identity],
    employee: { findMany: async () => options.employees ?? [employee] },
    unit: { findMany: async () => (options.employees ?? [employee]).flatMap(row => row.unit ? [row.unit] : []) },
    user: { findUnique: async () => ({ role: options.adminRole ?? "ADMIN", isActive: options.adminActive ?? true,
      authProvider: options.adminProvider ?? "SSO" }),
      findMany: async () => options.accounts ?? [], create: async (args: Prisma.UserCreateArgs) => {
        calls.data = args.data;
        calls.attempts++; if (options.failOnCreate === calls.attempts) throw new Error("create failed");
        calls.creates++; return { id: "new" };
      } },
  };
  const db = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>, transactionOptions: unknown) => {
    calls.transactions++; calls.options = transactionOptions;
    const before = calls.creates;
    try { return await callback(tx); } catch (error) { calls.creates = before; throw error; }
  } } as unknown as PrismaClient;
  return { db, calls };
}
describe("apply PIC import assignments", () => {
  const plan = planPicImport(input, [employee], []);
  it("applies approved abbreviations with the verified Employee unit ID", async () => {
    for (const [excelName, dbName] of [
      ["KANWIL ACEH", "KANTOR WILAYAH ACEH"],
      ["KANCAB BANDUNG", "KANTOR CABANG BANDUNG"],
      ["SEKRETARIAT PERUSAHAAN", "SEKRETARIS PERUSAHAAN"],
      ["PMO INFRASTRUKTUR PASCAPANEN", "PROJECT MANAGEMENT OFFICE INFRASTRUKTUR PASCAPANEN"],
      ["KANCAB TANGGERANG", "KANTOR CABANG TANGERANG"],
      ["KANCAV LANGGUR", "KANTOR CABANG LANGGUR"],
      ["UB JASTASMA", "UB-JASTASMA"],
      ["UB-SENTRA NIAGA", "UB-BULOG SENTRA NIAGA"],
      ["KANCAB BLANGPIDIE", "KANTOR CABANG BLANG PIDIE"],
      ["KANWIL JAKARTA DAN BANTEN", "KANTOR WILAYAH DKI JAKARTA DAN BANTEN"],
      ["KACAB BOGOR", "KANTOR CABANG BOGOR"],
      ["KANCAB PUTUSIBAU", "KANTOR CABANG PUTUSSIBAU"],
      ["KANCAB LUWUK", "KANTOR CABANG LUWUK BANGGAI"],
      ["KANCAB TOLITOLI", "KANTOR CABANG TOLI-TOLI"],
      ["KANCAB POLEWALI MANDAR", "KANTOR CABANG POLMAN"],
      ["KANWIL PAPUA DAN PABAR", "KANTOR WILAYAH PAPUA"],
      ["KANCAB FAK-FAK", "KANTOR CABANG FAK FAK"],
      ["KANCAB TEMBINABUAN", "KANTOR CABANG TEMINABUAN"],
    ]) {
      const candidate = { ...employee, unit: { id: "unit-1", name: dbName } };
      const rows = [{ ...input[0], unitName: excelName }];
      const preview = planPicImport(rows, [candidate], []);
      const { db, calls } = database({ employees: [candidate] });
      assert.deepEqual(await applyPicImportAssignments(rows, preview, confirmation, db),
        { createdCount: 1, alreadyAssignedCount: 0, skippedCount: 0, skippedRows: [] });
      assert.deepEqual(calls.data?.unit, { connect: { id: "unit-1" } });
    }
  });
  it("creates a new linked PIC in one serializable transaction", async () => {
    const { db, calls } = database();
    assert.deepEqual(await applyPicImportAssignments(input, plan, confirmation, db),
      { createdCount: 1, alreadyAssignedCount: 0, skippedCount: 0, skippedRows: [] });
    assert.equal(calls.transactions, 1); assert.equal(calls.creates, 1);
    assert.deepEqual(calls.data, { username: employee.nip, samlNameId: employee.nip,
      name: employee.name, authProvider: "SSO", role: "PIC", isActive: true,
      unit: { connect: { id: employee.unitId } }, employee: { connect: { id: employee.id } } });
    assert.deepEqual(calls.options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });
  });
  it("rejects Employee, unit, account, Admin or target changes before creation", async () => {
    for (const options of [{ employees: [{ ...employee, isPresentInSource: false }] },
      { employees: [{ ...employee, unit: { id: "unit-1", name: "Changed" } }] }, { adminRole: "VIEWER" }]) {
      const { db, calls } = database(options);
      await assert.rejects(() => applyPicImportAssignments(input, plan, confirmation, db));
      assert.equal(calls.creates, 0);
    }
    const { db } = database();
    await assert.rejects(() => applyPicImportAssignments(input, plan, { ...confirmation, targetFingerprint: "different" }, db));
  });
  it("skips a matching active PIC on a repeated clean preview", async () => {
    const accounts: PicImportAccountSnapshot[] = [{ id: "user-1", username: "00123", samlNameId: "00123",
      employeeId: "employee-1", authProvider: "SSO", role: "PIC", isActive: true, unitId: "unit-1" }];
    const { db, calls } = database({ accounts });
    const repeat = planPicImport(input, [employee], accounts);
    assert.deepEqual(await applyPicImportAssignments(input, repeat, confirmation, db),
      { createdCount: 0, alreadyAssignedCount: 1, skippedCount: 0, skippedRows: [] });
    assert.equal(calls.creates, 0);
    await assert.rejects(() => applyPicImportAssignments(input, plan, confirmation, db));
  });
  it("rolls back earlier creations when a later creation fails", async () => {
    const second = { ...employee, id: "employee-2", nip: "00456" };
    const rows = [...input, { rowNumber: 7, nip: second.nip, unitName: second.unit!.name }];
    const batchPlan = planPicImport(rows, [employee, second], []);
    const { db, calls } = database({ employees: [employee, second], failOnCreate: 2 });
    await assert.rejects(() => applyPicImportAssignments(rows, batchPlan, confirmation, db), /create failed/);
    assert.equal(calls.attempts, 2);
    assert.equal(calls.transactions, 1); assert.equal(calls.creates, 0);
  });
  it("creates only valid new accounts and reports every skipped error or review in partial mode", async () => {
    const candidates = [employee,
      { ...employee, id: "ineligible", nip: "00200", jenjang: "3" },
      { ...employee, id: "wrong-unit", nip: "00300", unitId: "other", unit: { id: "other", name: "DIVISI MANAJEMEN MUTU" } },
      { ...employee, id: "unknown-unit", nip: "00400" },
    ];
    const rows = [...input, { rowNumber: 7, nip: "absent", unitName: "Unknown" },
      { rowNumber: 8, nip: "00200", unitName: employee.unit!.name },
      { rowNumber: 9, nip: "00300", unitName: employee.unit!.name },
      { rowNumber: 10, nip: "00400", unitName: "Unreviewed unit" }];
    const batchPlan = planPicImport(rows, candidates, []);
    const { db, calls } = database({ employees: candidates });
    await assert.rejects(() => applyPicImportAssignments(rows, batchPlan, confirmation, db));
    assert.equal(calls.transactions, 0);
    const result = await applyPicImportAssignments(rows, batchPlan, { ...confirmation, skipInvalid: true }, db);
    assert.equal(result.createdCount, 1);
    assert.equal(result.skippedCount, 4);
    assert.deepEqual(result.skippedRows.map(row => row.reason),
      ["EMPLOYEE_NOT_FOUND", "EMPLOYEE_INELIGIBLE", "UNIT_MISMATCH", "UNIT_NAME_REQUIRES_REVIEW"]);
    assert.equal(calls.creates, 1);
    assert.deepEqual(calls.data?.employee, { connect: { id: employee.id } });
  });
  it("leaves VIEWER, inactive, LOCAL, ADMIN and conflicting assignments untouched in partial mode", async () => {
    const candidate = { ...employee, id: "existing-employee", nip: "00999" };
    const rows = [...input, { rowNumber: 7, nip: candidate.nip, unitName: candidate.unit!.name }];
    const existing: PicImportAccountSnapshot = { id: "existing-user", username: candidate.nip,
      samlNameId: candidate.nip, employeeId: candidate.id, authProvider: "SSO", role: "PIC", isActive: true, unitId: candidate.unitId };
    for (const overrides of [{ role: "VIEWER" }, { isActive: false }, { authProvider: "LOCAL" },
      { role: "ADMIN" }, { unitId: "different" }, { employeeId: null },
      { username: "different" }] as Partial<PicImportAccountSnapshot>[]) {
      const accounts = [{ ...existing, ...overrides }];
      const batchPlan = planPicImport(rows, [employee, candidate], accounts);
      const { db, calls } = database({ employees: [employee, candidate], accounts });
      const result = await applyPicImportAssignments(rows, batchPlan, { ...confirmation, skipInvalid: true }, db);
      assert.equal(result.createdCount, 1);
      assert.equal(result.skippedRows[0].reason, "EXISTING_ACCOUNT_REQUIRES_ADMIN_REVIEW");
      assert.deepEqual(calls.data?.employee, { connect: { id: employee.id } });
    }
  });
  it("rechecks all partial-preview rows, Admin and target before writing", async () => {
    const absent = { ...employee, id: "new-employee", nip: "00999" };
    const rows = [...input, { rowNumber: 7, nip: absent.nip, unitName: absent.unit!.name }];
    const batchPlan = planPicImport(rows, [employee], []);
    const partial = { ...confirmation, skipInvalid: true };
    for (const options of [{ employees: [employee, absent] },
      { employees: [{ ...employee, jenjang: "3" }] }, { adminRole: "PIC" },
      { adminActive: false }, { adminProvider: "LOCAL" }]) {
      const { db, calls } = database(options);
      await assert.rejects(() => applyPicImportAssignments(rows, batchPlan, partial, db));
      assert.equal(calls.creates, 0);
    }
    const { db, calls } = database();
    await assert.rejects(() => applyPicImportAssignments(rows, batchPlan,
      { ...partial, targetFingerprint: "different" }, db));
    assert.equal(calls.creates, 0);
    const duplicate = [...input, ...input];
    await assert.rejects(() => applyPicImportAssignments(duplicate,
      planPicImport(duplicate, [employee], []), partial, db));
  });
  it("rolls back all valid creations if a later valid creation fails in partial mode", async () => {
    const second = { ...employee, id: "employee-2", nip: "00456" };
    const rows = [...input, { rowNumber: 7, nip: "absent", unitName: "Unknown" },
      { rowNumber: 8, nip: second.nip, unitName: second.unit!.name }];
    const batchPlan = planPicImport(rows, [employee, second], []);
    const { db, calls } = database({ employees: [employee, second], failOnCreate: 2 });
    await assert.rejects(() => applyPicImportAssignments(rows, batchPlan,
      { ...confirmation, skipInvalid: true }, db), /create failed/);
    assert.equal(calls.attempts, 2);
    assert.equal(calls.creates, 0);
  });
  it("does not duplicate an assigned PIC when rerunning a partial import with a fresh preview", async () => {
    const rows = [...input, { rowNumber: 7, nip: "absent", unitName: "Unknown" }];
    const accounts: PicImportAccountSnapshot[] = [{ id: "user-1", username: employee.nip,
      samlNameId: employee.nip, employeeId: employee.id, authProvider: "SSO", role: "PIC", isActive: true, unitId: employee.unitId }];
    const { db, calls } = database({ accounts });
    const result = await applyPicImportAssignments(rows, planPicImport(rows, [employee], accounts),
      { ...confirmation, skipInvalid: true }, db);
    assert.equal(result.createdCount, 0);
    assert.equal(result.alreadyAssignedCount, 1);
    assert.equal(result.skippedCount, 1);
    assert.equal(calls.creates, 0);
    await assert.rejects(() => applyPicImportAssignments(rows, planPicImport(rows, [employee], []),
      { ...confirmation, skipInvalid: true }, db));
  });
});
