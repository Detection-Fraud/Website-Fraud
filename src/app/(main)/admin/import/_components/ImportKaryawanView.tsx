"use client";

import AppBar from "@/components/layout/Appbar";
import { useImportKaryawan } from "@/hooks/useImportKaryawan";
import type { EmployeeImportImpact } from "@/schemas/employee-import.schema";
import type { EmployeeSyncStatusResponse } from "@/schemas/employee-sync.schema";
import { Button, Card, Spinner } from "@heroui/react";
import { useRef, type ChangeEvent, type KeyboardEvent } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiRefreshCw,
  FiServer,
  FiUploadCloud,
} from "react-icons/fi";

const CHANGE_LABELS: Record<keyof Omit<EmployeeImportImpact, "details">, string> = {
  newCount: "Karyawan baru",
  changedCount: "Data berubah",
  unchangedCount: "Tidak berubah",
  missingCount: "Tidak ada di snapshot baru",
  deactivationCount: "Akun SSO terdampak",
};

const DETAIL_LABELS = {
  NEW: "Baru",
  CHANGED: "Berubah",
  UNCHANGED: "Tidak berubah",
  MISSING: "Tidak ditemukan",
  DEACTIVATION: "Akun terdampak",
} as const;

const SAFE_RUN_ERRORS: Record<string, string> = {
  PENTAHO_EXECUTE_REJECTED: "Pentaho menolak permintaan sinkronisasi.",
  PENTAHO_JOB_FAILED: "Proses Pentaho berakhir dengan kegagalan.",
  PENTAHO_SYNC_DEADLINE_EXCEEDED: "Batas waktu sinkronisasi tercapai.",
  PENTAHO_MIRROR_VALIDATION_FAILED: "Snapshot Pentaho tidak lolos validasi.",
  PENTAHO_RECONCILIATION_FAILED: "Snapshot tidak dapat diterapkan ke data karyawan.",
  EXCEL_IMPORT_DEADLINE_EXCEEDED: "Batas waktu import Excel tercapai.",
  EXCEL_IMPORT_RECONCILIATION_FAILED: "Snapshot Excel tidak dapat diterapkan.",
};

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("id-ID");
}

function channelLabel(channel: EmployeeSyncStatusResponse["channel"]) {
  return channel === "PENTAHO" ? "Pentaho" : "Excel";
}

function phaseLabel(phase: EmployeeSyncStatusResponse["phase"]) {
  switch (phase) {
    case "TRIGGERING": return "Memulai proses";
    case "PENTAHO_RUNNING": return "Sinkronisasi Pentaho berjalan";
    case "VALIDATING": return "Memvalidasi snapshot";
    case "RECONCILING": return "Menerapkan data karyawan";
    case "COMPLETED": return "Selesai";
    default: return "Belum ada fase aktif";
  }
}

function runOutcome(status: EmployeeSyncStatusResponse["status"]) {
  if (status === "RUNNING") return "Sedang berjalan";
  return status === "SUCCEEDED" ? "Berhasil" : "Gagal";
}

function SafeError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
      <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SharedRunStatus({
  status,
  loading,
  failed,
  onRetry,
}: {
  status: EmployeeSyncStatusResponse | null | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <Card aria-live="polite" className="border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <FiClock aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Status proses snapshot karyawan</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Status terbaru untuk kedua jalur import.</p>
          </div>
        </div>
        {failed && (
          <Button variant="outline" size="sm" onPress={onRetry}>
            <FiRefreshCw aria-hidden="true" />
            Muat ulang status
          </Button>
        )}
      </div>
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Spinner size="sm" /> Memuat status...</div>
      ) : failed ? (
        <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">Status belum dapat dimuat. Aksi import dinonaktifkan sampai status berhasil diperiksa.</p>
      ) : status ? (
        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          <StatusValue label="Jalur" value={channelLabel(status.channel)} />
          <StatusValue label="Status" value={runOutcome(status.status)} />
          <StatusValue label="Fase" value={phaseLabel(status.phase)} />
          <StatusValue label="Dimulai" value={dateLabel(status.startedAt)} />
          <StatusValue label="Diterima" value={status.receivedCount.toLocaleString("id-ID")} />
          <StatusValue label="Diproses" value={status.processedCount.toLocaleString("id-ID")} />
          <StatusValue label="Tidak ditemukan" value={status.missingCount.toLocaleString("id-ID")} />
          <StatusValue label="Akun SSO terdampak" value={status.deactivatedCount.toLocaleString("id-ID")} />
          {status.completedAt && <StatusValue label="Selesai" value={dateLabel(status.completedAt)} />}
          {status.status === "FAILED" && status.errorMessage && (
            <p role="alert" className="sm:col-span-2 lg:col-span-4 text-rose-700 dark:text-rose-300">
              {SAFE_RUN_ERRORS[status.errorMessage] ?? "Proses snapshot gagal. Periksa data dan coba kembali."}
            </p>
          )}
        </dl>
      ) : (
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <FiCheckCircle aria-hidden="true" /> Belum ada proses snapshot karyawan.
        </div>
      )}
    </Card>
  );
}

function StatusValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{value}</dd></div>;
}

function ImpactPreview({ impact }: { impact: EmployeeImportImpact }) {
  const { details, ...counts } = impact;
  return (
    <Card className="space-y-4 border border-slate-200 p-4 dark:border-slate-800 sm:p-5">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Dampak snapshot</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Ringkasan seluruh snapshot dan paling banyak 100 detail perubahan.</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(CHANGE_LABELS) as Array<keyof typeof CHANGE_LABELS>).map((key) => (
          <div key={key} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
            <dt className="text-xs leading-5 text-slate-600 dark:text-slate-400">{CHANGE_LABELS[key]}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{counts[key].toLocaleString("id-ID")}</dd>
          </div>
        ))}
      </dl>
      {details.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="sr-only">Maksimum 100 detail dampak snapshot karyawan</caption>
            <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"><tr><th scope="col" className="px-3 py-2">NIP</th><th scope="col" className="px-3 py-2">Perubahan</th></tr></thead>
            <tbody>{details.map((detail, index) => <tr key={`${detail.nip}-${detail.change}-${index}`} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{detail.nip}</td><td className="px-3 py-2 text-slate-700 dark:text-slate-200">{DETAIL_LABELS[detail.change]}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-600 dark:text-slate-400">Tidak ada perubahan rinci untuk ditampilkan.</p>}
    </Card>
  );
}

export default function ImportKaryawanView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const intake = useImportKaryawan();
  const statusUnknown = intake.statusLoading || intake.statusError;
  const actionsBlocked = statusUnknown || intake.hasActiveRun || intake.isCheckingCommitStatus;

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === "Home" ? "pentaho"
      : event.key === "End" ? "excel"
      : intake.activeTab === "pentaho" ? "excel" : "pentaho";
    intake.setActiveTab(nextTab);
    document.getElementById(`employee-import-tab-${nextTab}`)?.focus();
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) void intake.handleFileSelect(selected);
    event.target.value = "";
  };

  return (
    <main className="space-y-5 pb-10">
      <AppBar title="Data Karyawan" description="Masukkan snapshot karyawan melalui Pentaho atau workbook Excel resmi." showAddButton={false} />

      <SharedRunStatus status={intake.status} loading={intake.statusLoading} failed={intake.statusError} onRetry={() => void intake.retryStatus()} />

      {intake.errorMsg && <SafeError message={intake.errorMsg} />}

      {intake.hasActiveRun && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Proses {intake.status?.channel === "PENTAHO" ? "Pentaho" : "Excel"} sedang berjalan. Aksi mulai dan terapkan snapshot dinonaktifkan sampai proses selesai.
        </p>
      )}

      <div role="tablist" aria-label="Pilih jalur import karyawan" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        <button type="button" role="tab" id="employee-import-tab-pentaho" aria-controls="employee-import-panel-pentaho" aria-selected={intake.activeTab === "pentaho"} tabIndex={intake.activeTab === "pentaho" ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => intake.setActiveTab("pentaho")} className={`min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${intake.activeTab === "pentaho" ? "bg-white text-sky-800 shadow-sm dark:bg-slate-800 dark:text-sky-200" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}>
          <FiServer aria-hidden="true" className="mr-2 inline" /> Sinkronisasi Pentaho
        </button>
        <button type="button" role="tab" id="employee-import-tab-excel" aria-controls="employee-import-panel-excel" aria-selected={intake.activeTab === "excel"} tabIndex={intake.activeTab === "excel" ? 0 : -1} onKeyDown={handleTabKeyDown} onClick={() => intake.setActiveTab("excel")} className={`min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${intake.activeTab === "excel" ? "bg-white text-sky-800 shadow-sm dark:bg-slate-800 dark:text-sky-200" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}>
          <FiUploadCloud aria-hidden="true" className="mr-2 inline" /> Import Excel
        </button>
      </div>

      <section id="employee-import-panel-pentaho" role="tabpanel" aria-labelledby="employee-import-tab-pentaho" hidden={intake.activeTab !== "pentaho"} className="space-y-4">
        <Card className="space-y-4 border border-slate-200 p-5 dark:border-slate-800 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><FiServer aria-hidden="true" size={18} /></span>
            <div><h2 className="font-semibold text-slate-900 dark:text-slate-100">Sinkronisasi melalui Pentaho</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">Jalankan KJB/KTR yang mengambil snapshot penuh dari SI-SDM. Aplikasi akan memantau proses dan menerapkan snapshot setelah validasi berhasil.</p></div>
          </div>
          <Button variant="primary" onPress={intake.startPentaho} isPending={intake.isStarting} isDisabled={Boolean(actionsBlocked) || intake.isStarting}>
            {intake.isStarting ? <Spinner size="sm" color="current" /> : <FiRefreshCw aria-hidden="true" />}
            Mulai sinkronisasi
          </Button>
        </Card>
      </section>

      <section id="employee-import-panel-excel" role="tabpanel" aria-labelledby="employee-import-tab-excel" hidden={intake.activeTab !== "excel"} className="space-y-4">
        <Card className="space-y-4 border border-slate-200 p-5 dark:border-slate-800 sm:p-6">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Import snapshot dari Excel</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">Gunakan template resmi dengan 14 kolom data karyawan. Metadata pembuatan dan perubahan diisi otomatis oleh sistem. File divalidasi sebagai snapshot penuh dan belum mengubah data sampai kamu meninjau dampak serta mengonfirmasi penerapan.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="outline" onPress={() => { window.location.assign("/api/employees/import/template"); }}>
              <FiDownload aria-hidden="true" /> Unduh template Excel
            </Button>
            <input ref={inputRef} id="employee-snapshot-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFileChange} disabled={Boolean(actionsBlocked) || intake.isPreviewing || intake.isCommitting} className="sr-only" aria-describedby="employee-snapshot-help" />
            <Button variant="secondary" onPress={() => inputRef.current?.click()} isPending={intake.isPreviewing} isDisabled={Boolean(actionsBlocked) || intake.isPreviewing || intake.isCommitting}>
              {intake.isPreviewing ? <Spinner size="sm" color="current" /> : <FiUploadCloud aria-hidden="true" />}
              {intake.file ? "Pilih file lain" : "Pilih file .xlsx"}
            </Button>
          </div>
          <p id="employee-snapshot-help" className="text-xs text-slate-500 dark:text-slate-400">Maksimum 25 MiB dan 100.000 baris data. File harus memakai sheet Karyawan dengan header resmi.</p>
          {intake.file && <p className="break-all text-sm text-slate-700 dark:text-slate-300">File dipilih: <span className="font-medium">{intake.file.name}</span></p>}
        </Card>

        {intake.previewExpired && <SafeError message="Preview sudah kedaluwarsa. Pilih kembali file yang sama untuk membuat preview baru." />}
        {intake.preview && <ImpactPreview impact={intake.preview.impact} />}

        {intake.preview && (
          <Card className="space-y-4 border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20 sm:p-5">
            <div>
              <h3 className="font-semibold text-amber-950 dark:text-amber-100">Konfirmasi snapshot penuh</h3>
              <p id="employee-full-snapshot-warning" className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-200">Karyawan yang tidak ada di file dapat ditandai tidak hadir dari sumber. Akun SSO terkait dapat dinonaktifkan sesuai aturan sistem. Pastikan dampak di atas sudah ditinjau.</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-slate-900 dark:text-slate-100">
              <input type="checkbox" checked={intake.confirmedFullSnapshot} onChange={(event) => intake.setConfirmedFullSnapshot(event.target.checked)} aria-describedby="employee-full-snapshot-warning" className="mt-0.5 size-4 accent-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" />
              Saya memahami dan mengonfirmasi penerapan snapshot penuh ini.
            </label>
            <p className="text-xs text-slate-600 dark:text-slate-400">Preview berlaku sampai {new Date(intake.preview.expiresAt).toLocaleString("id-ID")} dan hanya dapat digunakan satu kali.</p>
            <Button variant="primary" onPress={intake.handleCommit} isPending={intake.isCommitting} isDisabled={!intake.confirmedFullSnapshot || Boolean(actionsBlocked) || intake.isCommitting}>
              {intake.isCommitting ? <Spinner size="sm" color="current" /> : <FiCheckCircle aria-hidden="true" />}
              {intake.isCheckingCommitStatus ? "Memeriksa status terbaru..." : "Terapkan snapshot"}
            </Button>
          </Card>
        )}

        {intake.result && (
          <Card role="status" className={`border p-4 sm:p-5 ${intake.result.status === "SUCCEEDED" ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30"}`}>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{intake.result.status === "SUCCEEDED" ? "Snapshot berhasil diterapkan" : "Snapshot gagal diterapkan"}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <StatusValue label="Diterima" value={intake.result.receivedCount.toLocaleString("id-ID")} />
              <StatusValue label="Diproses" value={intake.result.processedCount.toLocaleString("id-ID")} />
              <StatusValue label="Tidak ditemukan" value={intake.result.missingCount.toLocaleString("id-ID")} />
              <StatusValue label="Akun SSO terdampak" value={intake.result.deactivatedCount.toLocaleString("id-ID")} />
            </dl>
          </Card>
        )}

        {!intake.preview && !intake.previewExpired && !intake.file && !intake.isPreviewing && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" /> Pilih file Excel untuk memulai validasi dan melihat ringkasan dampaknya.
          </div>
        )}
      </section>
    </main>
  );
}
