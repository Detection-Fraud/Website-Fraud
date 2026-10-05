import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import dotenv from "dotenv";

class CliError extends Error {}
let stage = "membaca argumen";

function safeDatabaseDiagnostics(error: unknown) {
  const codes = new Set<string>();
  const kinds = new Set<string>();
  const messages = new Set<string>();
  const secrets = Object.entries(process.env)
    .filter(([key, value]) => /PASSWORD|SECRET|TOKEN|DATABASE_URL|API_KEY|PRIVATE_KEY/i.test(key) && value)
    .map(([, value]) => value!);
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      for (const value of [url.username, url.password]) {
        if (value) secrets.push(value, decodeURIComponent(value));
      }
    } catch { /* A malformed URL is handled by the database driver. */ }
  }
  secrets.sort((a, b) => b.length - a.length);
  function redact(value: string) {
    let message = value;
    for (const secret of secrets) message = message.split(secret).join("<REDACTED>");
    return message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<REDACTED_URL>")
      .replace(/\b(password|passwd|pwd|token|secret)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1=<REDACTED>")
      .replace(/[\r\n\t]+/g, " ").slice(0, 800);
  }
  function visit(value: unknown, depth: number) {
    if (!value || typeof value !== "object" || depth > 5) return;
    const item = value as Record<string, unknown>;
    for (const key of ["code", "originalCode"]) {
      if (typeof item[key] === "string" && (/^[A-Z0-9_]{2,32}$/.test(item[key]) || item[key] === "N/A")) codes.add(item[key]);
    }
    if (typeof item.kind === "string" && /^[A-Za-z]{2,48}$/.test(item.kind)) kinds.add(item.kind);
    // Read only upstream metadata messages, never the Prisma stack/query wrapper.
    if (depth > 0) {
      for (const key of ["message", "originalMessage"]) {
        if (typeof item[key] === "string") messages.add(redact(item[key]));
      }
    }
    for (const key of ["meta", "cause", "driverAdapterError"]) visit(item[key], depth + 1);
  }
  visit(error, 0);
  if (!messages.size && codes.has("P2010") && error instanceof Error) {
    messages.add(redact(error.message));
  }
  return { codes: [...codes], kinds: [...kinds], messages: [...messages] };
}

async function main() {
  const { values } = parseArgs({ options: {
    file: { type: "string" }, apply: { type: "boolean", default: false },
    "skip-invalid": { type: "boolean", default: false },
    report: { type: "string" }, "preview-report": { type: "string" },
    "confirm-file": { type: "string" }, "confirm-target": { type: "string" },
    "admin-user-id": { type: "string" }, help: { type: "boolean", default: false },
  }, strict: true });
  if (values.help) {
    console.log(`Pratinjau (tanpa menulis database):
  npm run import:pic -- --file "Daftar_PIC.xlsx"

Terapkan setelah pratinjau bersih:
  npm run import:pic -- --file "Daftar_PIC.xlsx" --apply --preview-report "Daftar_PIC.xlsx.pic-preview.json" --confirm-file <SHA256_FILE> --confirm-target <FINGERPRINT_DB> --admin-user-id <ID_ADMIN_SSO_AKTIF>

Untuk melewati baris ERROR dan REVIEW, tambahkan --skip-invalid pada pratinjau DAN penerapan.
Mode ini hanya memproses CREATE dan ALREADY_ASSIGNED; file rusak dan NIP duplikat tetap ditolak.

DATABASE_URL dibaca dari .env.local, kemudian .env. Jangan gunakan file template kosong.
Hasil pratinjau disimpan ke <file>.pic-preview.json; --report dapat mengubah lokasinya.
Laporan tidak ditimpa; gunakan --report baru untuk pratinjau berikutnya.`);
    return;
  }
  if (!values.file) throw new CliError("Gunakan --file <path.xlsx>; lihat --help");
  if (values.apply && (!values["preview-report"] || !values["confirm-file"] ||
      !values["confirm-target"] || !values["admin-user-id"])) {
    throw new CliError("Mode terapkan memerlukan preview-report, confirm-file, confirm-target, dan admin-user-id");
  }
  stage = "memuat konfigurasi dan Prisma";
  dotenv.config({ path: [".env.local", ".env"], quiet: true });
  if (!process.env.DATABASE_URL) throw new CliError("DATABASE_URL belum diatur");
  const { parsePicImportWorkbook, previewPicImport, applyPicImportAssignments,
    canApplyPicImportPlan, assertPicImportPreviewReceipt, PIC_IMPORT_MAX_FILE_BYTES } = await import("@/lib/pic-import");
  const { readPicImportDatabaseTarget } = await import("@/lib/pic-import-target");
  const { prisma } = await import("@/lib/prisma");
  try {
    stage = "membaca dan memvalidasi Excel";
    const filePath = path.resolve(values.file);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size > PIC_IMPORT_MAX_FILE_BYTES) throw new CliError("File tidak valid atau lebih dari 5 MB");
    const buffer = await readFile(filePath);
    const fileSha256 = createHash("sha256").update(buffer).digest("hex");
    const rows = await parsePicImportWorkbook(filePath, buffer);
    stage = "membaca identitas database";
    const target = await readPicImportDatabaseTarget(prisma);
    stage = "membaca Employee dan akun";
    const plan = await previewPicImport(rows, prisma);
    const skipInvalid = values["skip-invalid"] === true;
    const canApply = canApplyPicImportPlan(plan, skipInvalid);
    console.log("File SHA256:", fileSha256);
    console.log("Target database:", JSON.stringify(target.identity));
    console.log("Target fingerprint:", target.fingerprint);
    console.table(plan.rows.map(row => ({ baris: row.rowNumber, NIP: row.nip, UNIT_KERJA: row.unitName,
      UNIT_EMPLOYEE: row.employeeUnitName ?? "", hasil: row.status, alasan: row.reason })));
    console.log("Ringkasan:", plan.counts);
    console.log("Mode:", skipInvalid ? "SEBAGIAN — ERROR/REVIEW dilewati" : "SELURUH FILE");
    if (skipInvalid) console.log("Baris yang akan dilewati:", plan.counts.ERROR + plan.counts.REVIEW);
    if (!values.apply) {
      stage = "menyimpan laporan pratinjau";
      const reportPath = path.resolve(values.report ?? `${filePath}.pic-preview.json`);
      if (!reportPath.toLowerCase().endsWith(".json")) throw new CliError("Laporan pratinjau harus berupa file .json baru");
      await writeFile(reportPath, JSON.stringify({ version: 2, fileSha256, targetFingerprint: target.fingerprint,
        skipInvalid, canApply, counts: plan.counts, rows: plan.rows }, null, 2), { mode: 0o600, flag: "wx" });
      console.log("Laporan pratinjau:", reportPath);
      if (!canApply) process.exitCode = 1;
      return;
    }
    if (!canApply) throw new CliError(skipInvalid ? "Tidak ada baris yang dapat diterapkan" :
      "Ada baris salah/perlu tinjauan; gunakan pratinjau --skip-invalid untuk penerapan sebagian");
    if (values["confirm-file"] !== fileSha256 || values["confirm-target"] !== target.fingerprint) {
      throw new CliError("Konfirmasi file atau target database tidak cocok");
    }
    stage = "memvalidasi laporan pratinjau";
    const receipt: unknown = JSON.parse(await readFile(path.resolve(values["preview-report"]!), "utf8"));
    assertPicImportPreviewReceipt(receipt, { fileSha256, targetFingerprint: target.fingerprint, skipInvalid }, plan);
    stage = "menerapkan penetapan PIC";
    const result = await applyPicImportAssignments(rows, plan, {
      adminUserId: values["admin-user-id"]!, targetFingerprint: target.fingerprint, skipInvalid,
    }, prisma);
    console.log("Penetapan selesai:", { createdCount: result.createdCount,
      alreadyAssignedCount: result.alreadyAssignedCount, skippedCount: result.skippedCount });
    if (result.skippedRows.length) {
      console.log("Baris dilewati (tidak diubah):");
      console.table(result.skippedRows.map(row => ({ baris: row.rowNumber, NIP: row.nip, hasil: row.status, alasan: row.reason })));
      console.log("Detail baris yang dilewati ada pada laporan pratinjau:", path.resolve(values["preview-report"]!));
    }
  } finally { await prisma.$disconnect(); }
}

main().catch(error => {
  // Prisma/driver failures may contain connection details; keep those out of CLI output.
  const message = error instanceof CliError ? error.message :
    error instanceof Error && ["PicImportWorkbookError", "PicImportOperationError"].includes(error.name) ? error.message : "Operasi gagal; periksa konfigurasi atau keadaan database";
  const code = error && typeof error === "object" && "code" in error &&
    typeof error.code === "string" && /^[A-Z0-9_]{2,32}$/.test(error.code) ? error.code : undefined;
  console.error(`Gagal pada tahap ${stage}: ${message}${code ? ` (kode ${code})` : ""}`);
  const diagnostics = safeDatabaseDiagnostics(error);
  if (code === "P2010" || diagnostics.codes.length > 1 || diagnostics.kinds.length || diagnostics.messages.length) {
    console.error("Detail aman database:", JSON.stringify(diagnostics));
  }
  if (code === "EEXIST") console.error("Laporan sudah ada. Gunakan --report dengan nama file .json baru.");
  if (diagnostics.codes.some(value => ["P1000", "28P01", "28000"].includes(value))) console.error("Periksa username dan password database di DATABASE_URL.");
  if (diagnostics.codes.some(value => ["P1001", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(value))) console.error("Periksa apakah PostgreSQL aktif serta host dan port DATABASE_URL dapat dijangkau.");
  if (["P2021", "P2022"].includes(code ?? "")) console.error("Tabel atau kolom tidak sesuai skema aplikasi; periksa target database dan status migrasinya.");
  process.exitCode = 1;
});
