"use client";

import { isEmploymentActive, isPicEligible } from "@/lib/employee-eligibility";
import AppBar from "@/components/layout/Appbar";
import DataTable, { TableColumn } from "@/components/layout/DataTable";
import { useEmployeeManagement } from "@/hooks/useEmployeeManagement";
import {
  getEmployeeAdminActions,
  getEmployeeAdminReasons,
  getEmployeeAdminActionLabel,
  getEmployeePicManagementLink,
  type EmployeeAdminAction,
} from "@/lib/employee-management-actions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  EmployeeAccount,
  EmployeeAccountFilter,
  EmployeeEmploymentFilter,
  EmployeeRoleFilter,
  EmployeeSourceFilter,
} from "@/types/user.types";
import {
  Button,
  Card,
  ListBox,
  Modal,
  SearchField,
  SearchFieldGroup,
  Select,
  useOverlayState,
} from "@heroui/react";
import { type ReactNode, useState } from "react";
import ManageAdminModal from "./ManageAdminModal";

const columns: TableColumn[] = [
  { key: "employee", label: "Employee" },
  { key: "placement", label: "Unit HR / Pentaho" },
  { key: "employment", label: "Kepegawaian" },
  { key: "eligibility", label: "Kelayakan PIC" },
  { key: "account", label: "Akun User" },
  { key: "action", label: "Detail" },
];

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
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      className="min-w-44"
      value={value}
      onChange={(key) => onChange(String(key))}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
            >
              <ListBox.ItemIndicator />
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function EmployeeDetail({ employee }: { employee: EmployeeAccount }) {
  const employmentActive = isEmploymentActive(employee);
  const picEligible = isPicEligible(employee);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Identitas Employee
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900">
          {employee.name}
        </h3>
        <p className="text-sm text-slate-500">NIP {employee.nip}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-400">Unit HR / Pentaho</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {employee.unit?.name ?? "Belum dipetakan"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Employee.unitId: {employee.unitId ?? "—"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-400">Status sumber</p>
          <div className="mt-2">
            <StatusBadge
              tone={employee.isPresentInSource ? "success" : "danger"}
            >
              {employee.isPresentInSource
                ? "Ada di source terbaru"
                : "Tidak ada di source terbaru"}
            </StatusBadge>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-400">Status kepegawaian</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {employmentActive ? "Aktif" : "Tidak aktif"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            KODE_STATPEG {employee.kodeStatpeg} · STAT_KEPEG{" "}
            {employee.statKepeg}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-400">Kelayakan PIC</p>
          <div className="mt-2">
            <StatusBadge tone={picEligible ? "success" : "neutral"}>
              {picEligible ? "Memenuhi syarat" : "Tidak memenuhi syarat"}
            </StatusBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Jenjang {employee.jenjang}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs uppercase tracking-wide text-blue-600">
          Akun aplikasi
        </p>

        {employee.user ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-blue-700/70">User</p>
              <p className="text-sm font-semibold text-blue-950">
                {employee.user.name}
              </p>
              <p className="text-xs text-blue-800/70">
                {employee.user.username ?? "Username belum tersedia"}
              </p>
            </div>

            <div>
              <p className="text-xs text-blue-700/70">Status akun</p>
              <p className="text-sm font-semibold text-blue-950">
                {employee.user.isActive ? "Aktif" : "Tidak aktif"}
              </p>
              <p className="text-xs text-blue-800/70">
                Role {employee.user.role} · Provider{" "}
                {employee.user.authProvider}
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs text-blue-700/70">
                Unit otorisasi aplikasi
              </p>
              <p className="text-sm font-semibold text-blue-950">
                {employee.user.unit?.name ??
                  employee.user.unitId ??
                  "Belum ditetapkan"}
              </p>
              <p className="text-xs text-blue-800/70">
                User.unitId: {employee.user.unitId ?? "—"}
              </p>
            </div>
            {getEmployeePicManagementLink(employee) && (
              <div className="sm:col-span-2">
                <a
                  className="text-sm font-semibold text-blue-700 underline-offset-4 hover:underline"
                  href={getEmployeePicManagementLink(employee) ?? undefined}
                >
                  Buka tautan read-only di Manajemen PIC
                </a>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-blue-950">
            Employee belum tertaut ke akun User aplikasi.
          </p>
        )}
      </div>
    </div>
  );
}

export default function EmployeeManagementView() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<EmployeeSourceFilter>("ALL");
  const [employment, setEmployment] = useState<EmployeeEmploymentFilter>("ALL");
  const [account, setAccount] = useState<EmployeeAccountFilter>("ALL");
  const [role, setRole] = useState<EmployeeRoleFilter>("ALL");
  const [page, setPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeAccount | null>(null);
  const [adminAction, setAdminAction] = useState<{
    employee: EmployeeAccount;
    action: EmployeeAdminAction;
    reasons: ReturnType<typeof getEmployeeAdminReasons>;
  } | null>(null);

  const detailState = useOverlayState();
  const { user: currentUser } = useCurrentUser();

  const { employees, pagination, isLoading, error, refetch } =
    useEmployeeManagement({
      search,
      source,
      employment,
      account,
      role,
      page,
      limit: 10,
    });

  const handleFilterChange = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const handleOpenDetail = (employee: EmployeeAccount) => {
    setSelectedEmployee(employee);
    detailState.open();
  };

  const handleAdminAction = (employee: EmployeeAccount, action: EmployeeAdminAction) => {
    setAdminAction({
      employee,
      action,
      reasons: getEmployeeAdminReasons(employee, currentUser?.id),
    });
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <AppBar
        title="Manajemen Employee & User"
        description="Pantau data Employee HR/Pentaho dan keterkaitannya dengan akun aplikasi"
        showAddButton={false}
      />

      <Card className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <Card.Header className="gap-1 border-b border-slate-100 px-5 py-4">
          <Card.Title className="text-base font-semibold text-slate-900">
            Daftar Employee
          </Card.Title>
          <Card.Description>
            Status HR, source, kelayakan PIC, dan otorisasi User ditampilkan
            sebagai konsep yang terpisah.
          </Card.Description>
        </Card.Header>

        <Card.Content className="space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchField className="min-w-0 flex-1">
              <SearchFieldGroup className="bg-slate-50">
                <SearchField.SearchIcon />
                <SearchField.Input
                  aria-label="Cari Employee"
                  placeholder="Cari nama atau NIP"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />
                <SearchField.ClearButton onClick={handleClearSearch} />
              </SearchFieldGroup>
            </SearchField>

            <Button
              variant="secondary"
              onPress={handleSearch}
              className="shrink-0"
            >
              Cari
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <FilterSelect
              label="Filter source"
              value={source}
              onChange={(value) =>
                handleFilterChange(setSource, value as EmployeeSourceFilter)
              }
              options={[
                { id: "ALL", label: "Semua source" },
                { id: "PRESENT", label: "Ada di source" },
                {
                  id: "ABSENT",
                  label: "Tidak ada di source",
                },
              ]}
            />

            <FilterSelect
              label="Filter kepegawaian"
              value={employment}
              onChange={(value) =>
                handleFilterChange(
                  setEmployment,
                  value as EmployeeEmploymentFilter,
                )
              }
              options={[
                { id: "ALL", label: "Semua status HR" },
                {
                  id: "ACTIVE",
                  label: "Kepegawaian aktif",
                },
                {
                  id: "INACTIVE",
                  label: "Kepegawaian tidak aktif",
                },
              ]}
            />

            <FilterSelect
              label="Filter akun"
              value={account}
              onChange={(value) =>
                handleFilterChange(setAccount, value as EmployeeAccountFilter)
              }
              options={[
                { id: "ALL", label: "Semua akun" },
                { id: "LINKED", label: "Sudah tertaut" },
                { id: "UNLINKED", label: "Belum tertaut" },
                { id: "ACTIVE", label: "Akun aktif" },
                {
                  id: "INACTIVE",
                  label: "Akun tidak aktif",
                },
              ]}
            />

            <FilterSelect
              label="Filter role"
              value={role}
              onChange={(value) =>
                handleFilterChange(setRole, value as EmployeeRoleFilter)
              }
              options={[
                { id: "ALL", label: "Semua role" },
                { id: "ADMIN", label: "ADMIN" },
                { id: "PIC", label: "PIC" },
                { id: "VIEWER", label: "VIEWER" },
              ]}
            />
          </div>
        </Card.Content>
      </Card>

      {isLoading ? (
        <Card
          aria-live="polite"
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm"
        >
          <Card.Content className="p-10 text-center text-sm text-slate-500">
            Memuat data Employee…
          </Card.Content>
        </Card>
      ) : error ? (
        <Card
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 shadow-sm"
        >
          <Card.Content className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm font-semibold text-rose-800">
              Data Employee belum dapat dimuat.
            </p>
            <p className="text-xs text-rose-700">{error}</p>
            <Button variant="secondary" onPress={() => refetch()}>
              Coba lagi
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <Card.Content className="overflow-x-auto p-0">
            <DataTable<EmployeeAccount>
              column={columns}
              data={employees}
              ariaLabel="Daftar Employee dan akun User"
              pagination={pagination}
              onPageChange={setPage}
              renderEmptyState={() => (
                <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    Employee tidak ditemukan
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-slate-500">
                    Coba ubah kata kunci atau filter yang sedang digunakan.
                  </p>
                </div>
              )}
              renderCell={(employee, columnKey) => {
                const employmentActive = isEmploymentActive(employee);
                const picEligible = isPicEligible(employee);
                const adminActions = getEmployeeAdminActions(
                  employee,
                  currentUser?.id,
                );

                switch (columnKey) {
                  case "employee":
                    return (
                      <div>
                        <p className="font-semibold text-slate-800">
                          {employee.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          NIP {employee.nip}
                        </p>
                      </div>
                    );

                  case "placement":
                    return (
                      <div>
                        <p className="font-medium text-slate-700">
                          {employee.unit?.name ?? "Belum dipetakan"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Employee.unitId: {employee.unitId ?? "—"}
                        </p>
                      </div>
                    );

                  case "employment":
                    return (
                      <div className="space-y-1">
                        <StatusBadge
                          tone={employmentActive ? "success" : "neutral"}
                        >
                          {employmentActive ? "Aktif" : "Tidak aktif"}
                        </StatusBadge>
                        <p className="text-xs text-slate-500">
                          {employee.kodeStatpeg}/{employee.statKepeg}
                        </p>
                      </div>
                    );

                  case "eligibility":
                    return (
                      <StatusBadge tone={picEligible ? "success" : "neutral"}>
                        {picEligible ? "Layak PIC" : "Tidak layak"}
                      </StatusBadge>
                    );

                  case "account":
                    return employee.user ? (
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            tone={
                              employee.user.isActive ? "success" : "warning"
                            }
                          >
                            {employee.user.isActive ? "Aktif" : "Tidak aktif"}
                          </StatusBadge>
                          <span className="text-xs font-semibold text-slate-700">
                            {employee.user.role}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {employee.user.authProvider} · User.unitId{" "}
                          {employee.user.unitId ?? "—"}
                        </p>
                      </div>
                    ) : (
                      <StatusBadge tone="neutral">Belum tertaut</StatusBadge>
                    );

                  case "action":
                    return (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => handleOpenDetail(employee)}
                        >
                          Lihat detail
                        </Button>
                        {adminActions.map((action) => (
                          <Button
                            key={action}
                            size="sm"
                            variant={action === "REVOKE_ADMIN" ? "secondary" : "primary"}
                            onPress={() => handleAdminAction(employee, action)}
                          >
                            {getEmployeeAdminActionLabel(action)}
                          </Button>
                        ))}
                        {getEmployeePicManagementLink(employee) && (
                          <a
                            className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            href={getEmployeePicManagementLink(employee) ?? undefined}
                          >
                            Lihat PIC
                          </a>
                        )}
                      </div>
                    );

                  default:
                    return null;
                }
              }}
            />
          </Card.Content>
        </Card>
      )}

      <Modal isOpen={detailState.isOpen} onOpenChange={detailState.setOpen}>
        <Modal.Backdrop>
          <Modal.Container scroll="inside">
            <Modal.Dialog className="sm:max-w-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Detail Employee & User</Modal.Heading>
                <p className="text-sm text-slate-500">
                  Informasi HR/Pentaho dan akun aplikasi ditampilkan terpisah.
                </p>
              </Modal.Header>
              <Modal.Body>
                {selectedEmployee ? (
                  <EmployeeDetail employee={selectedEmployee} />
                ) : (
                  <p className="text-sm text-slate-500">
                    Tidak ada Employee yang dipilih.
                  </p>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ManageAdminModal
        employee={adminAction?.employee ?? null}
        action={adminAction?.action ?? null}
        reasons={adminAction?.reasons ?? []}
        isOpen={adminAction !== null}
        onClose={() => setAdminAction(null)}
        onSuccess={() => {
          setAdminAction(null);
          setSelectedEmployee(null);
          detailState.close();
          refetch();
        }}
      />
    </div>
  );
}
