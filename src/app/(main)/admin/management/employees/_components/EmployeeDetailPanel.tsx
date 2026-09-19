"use client";

import {
  getEmployeeAdminActionLabel,
  getEmployeeAdminActions,
  getEmployeeAdminReasonLabel,
  getEmployeeAdminReasons,
  getEmployeePicManagementLink,
  type EmployeeAdminAction,
} from "@/lib/employee-management-actions";
import { summarizeEmployeeUi } from "@/lib/employee-management-ui";
import type { EmployeeAccount } from "@/types/user.types";
import { Button } from "@heroui/react";
import type { ReactNode } from "react";

interface EmployeeDetailPanelProps {
  employee: EmployeeAccount | null;
  currentUserId?: string | null;
  onAction: (employee: EmployeeAccount, action: EmployeeAdminAction) => void;
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  const className = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];

  return (
    <span
      className={
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium " +
        className
      }
    >
      {children}
    </span>
  );
}

function DetailSection({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3" aria-labelledby={`employee-detail-${id}`}>
      <h3
        id={`employee-detail-${id}`}
        className="text-xs font-semibold uppercase tracking-wide text-slate-400"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-200 p-3 ${className}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

export default function EmployeeDetailPanel({
  employee,
  currentUserId,
  onAction,
}: EmployeeDetailPanelProps) {
  if (!employee) return null;

  const summary = summarizeEmployeeUi(employee);
  const adminActions = getEmployeeAdminActions(employee, currentUserId);
  const adminReasons = getEmployeeAdminReasons(employee, currentUserId);
  const picManagementLink = getEmployeePicManagementLink(employee);

  return (
    <div className="space-y-6">
      <DetailSection title="Identitas" id="identity">
        <div>
          <p className="text-lg font-semibold text-slate-900">
            {employee.name}
          </p>
          <p className="text-sm tabular-nums text-slate-500">
            NIP {employee.nip}
          </p>
        </div>
      </DetailSection>

      <DetailSection title="HR/Pentaho" id="hr-pentaho">
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem
            label="Unit HR / Pentaho"
            value={employee.unit?.name ?? "Belum dipetakan"}
          />

          <DetailItem
            label="Employee.unitId"
            value={
              <span className="tabular-nums">{employee.unitId ?? "—"}</span>
            }
          />

          <DetailItem
            label="Status sumber"
            value={
              <StatusBadge
                tone={employee.isPresentInSource ? "success" : "danger"}
              >
                {employee.isPresentInSource
                  ? "Ada di source terbaru"
                  : "Tidak ada di source terbaru"}
              </StatusBadge>
            }
          />

          <DetailItem
            label="Status kepegawaian"
            value={employee.employmentActive ? "Aktif" : "Tidak aktif"}
          />
        </div>

        <p className="text-xs tabular-nums text-slate-500">
          KODE_STATPEG {employee.kodeStatpeg} · STAT_KEPEG {employee.statKepeg}
        </p>
      </DetailSection>

      <DetailSection title="Eligibility" id="eligibility">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-800">
              Kelayakan PIC
            </span>

            <StatusBadge tone={employee.picEligible ? "success" : "neutral"}>
              {employee.picEligible
                ? "Memenuhi syarat"
                : "Tidak memenuhi syarat"}
            </StatusBadge>
          </div>

          <p className="mt-2 text-xs tabular-nums text-slate-500">
            Jenjang {employee.jenjang}; eligibility mengikuti status HR dan
            source.
          </p>
        </div>
      </DetailSection>

      <DetailSection title="Akun aplikasi" id="account">
        {employee.user ? (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem
                label="User"
                value={employee.user.name}
                className="border-blue-100 bg-white"
              />

              <DetailItem
                label="Username"
                value={employee.user.username ?? "Username belum tersedia"}
                className="border-blue-100 bg-white"
              />

              <DetailItem
                label="Status akun"
                value={
                  <StatusBadge
                    tone={employee.user.isActive ? "success" : "warning"}
                  >
                    {employee.user.isActive ? "Aktif" : "Tidak aktif"}
                  </StatusBadge>
                }
                className="border-blue-100 bg-white"
              />

              <DetailItem
                label="Role / provider"
                value={`${employee.user.role} · ${employee.user.authProvider}`}
                className="border-blue-100 bg-white"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <StatusBadge tone="neutral">Belum tertaut</StatusBadge>

            <p className="mt-2 text-sm text-slate-600">
              Employee belum tertaut ke akun User aplikasi. Status linkage ini
              tetap terpisah dari status employment dan source.
            </p>
          </div>
        )}
      </DetailSection>

      <DetailSection title="Scope otorisasi" id="authorization-scope">
        {employee.user ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-400">
                User.unitId · scope aplikasi
              </p>

              <p className="mt-1 text-sm font-medium text-slate-800">
                {employee.user.unit?.name ?? "Belum ditetapkan"}
              </p>

              <p className="mt-1 text-xs tabular-nums text-slate-500">
                {employee.user.unitId ?? "—"}
              </p>
            </div>

            {summary.unitScopeMismatch && (
              <div
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                role="note"
              >
                <p className="font-semibold">
                  Penempatan dan otorisasi berbeda
                </p>

                <p className="mt-1">
                  HR placement berbeda dari otorisasi aplikasi. Perubahan
                  Employee.unitId tidak otomatis mengubah User.unitId; Admin
                  harus meninjau dan menetapkan scope secara eksplisit.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Belum ada User, sehingga belum ada scope otorisasi aplikasi.
          </div>
        )}
      </DetailSection>

      <DetailSection title="Aksi" id="actions">
        {employee.user?.role === "PIC" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Akun PIC dikelola read-only dari inspector ini.
            {picManagementLink && (
              <a
                className="mt-2 inline-flex min-h-11 items-center rounded-md font-semibold text-blue-700 underline-offset-4 transition-colors duration-200 motion-reduce:transition-none hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                href={picManagementLink}
              >
                Buka Manajemen PIC
              </a>
            )}
          </div>
        )}

        {adminActions.length > 0 ? (
          <div className="flex flex-col items-stretch gap-2">
            {adminActions.map((action) => (
              <Button
                key={action}
                variant={action === "REVOKE_ADMIN" ? "secondary" : "primary"}
                className="min-h-11 w-full justify-center transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                onPress={() => onAction(employee, action)}
              >
                {getEmployeeAdminActionLabel(action)}
              </Button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700">
              Tidak ada aksi operasional yang tersedia.
            </p>

            {adminReasons.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {adminReasons.map((reason) => (
                  <li key={reason}>{getEmployeeAdminReasonLabel(reason)}</li>
                ))}
              </ul>
            )}

            {!adminReasons.length && (
              <p className="mt-1">
                Status akun ini tidak termasuk dalam alur admin yang ditangani
                halaman ini.
              </p>
            )}
          </div>
        )}
      </DetailSection>
    </div>
  );
}
