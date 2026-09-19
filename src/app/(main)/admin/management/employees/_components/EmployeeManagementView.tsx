"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable, { TableColumn } from "@/components/layout/DataTable";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useEmployeeManagement } from "@/hooks/useEmployeeManagement";
import {
  getEmployeeAdminReasons,
  getEmployeePicManagementLink,
  type EmployeeAdminAction,
} from "@/lib/employee-management-actions";
import { summarizeEmployeeUi } from "@/lib/employee-management-ui";
import type {
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
  SearchField,
  SearchFieldGroup,
  Select,
  Skeleton,
} from "@heroui/react";
import { type ReactNode, useEffect, useState } from "react";
import EmployeeDetailPanel from "./EmployeeDetailPanel";
import ManageAdminModal from "./ManageAdminModal";

const columns: TableColumn[] = [
  { key: "employee", label: "Employee" },
  { key: "placement", label: "Unit HR / Pentaho" },
  { key: "condition", label: "Kondisi HR/source" },
  { key: "account", label: "Akun aplikasi" },
  { key: "action", label: "Tinjauan" },
];

type ActiveFilterTag = {
  key: string;
  label: string;
  onClear: () => void;
};

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
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key ?? "ALL"))}
    >
      <Select.Trigger className="min-h-11 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2">
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

function EmployeeManagementSkeleton() {
  const skeletonClass = "rounded-lg motion-reduce:animate-none";

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="space-y-4"
    >
      <Card className="min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <Card.Header className="gap-2 border-b border-slate-100 px-5 py-4">
          <Skeleton
            animationType="pulse"
            className={`h-5 w-40 ${skeletonClass}`}
          />
          <Skeleton
            animationType="pulse"
            className={`h-4 w-72 max-w-full ${skeletonClass}`}
          />
        </Card.Header>

        <Card.Content className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton
              animationType="pulse"
              className={`h-11 min-w-0 flex-1 rounded-xl ${skeletonClass}`}
            />
            <Skeleton
              animationType="pulse"
              className={`h-11 w-20 rounded-xl ${skeletonClass}`}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton
                key={index}
                animationType="pulse"
                className={`h-11 w-44 rounded-xl ${skeletonClass}`}
              />
            ))}
          </div>

          <Skeleton
            animationType="pulse"
            className={`h-4 w-40 ${skeletonClass}`}
          />
        </Card.Content>
      </Card>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.85fr)]">
        <Card className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <Card.Header className="gap-2 border-b border-slate-100 px-5 py-4">
            <Skeleton
              animationType="pulse"
              className={`h-5 w-32 ${skeletonClass}`}
            />
            <Skeleton
              animationType="pulse"
              className={`h-4 w-48 ${skeletonClass}`}
            />
          </Card.Header>

          <Card.Content className="space-y-4 p-5">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="grid gap-3 border-b border-slate-100 pb-4 last:border-b-0"
              >
                <Skeleton
                  animationType="pulse"
                  className={`h-4 w-40 ${skeletonClass}`}
                />
                <Skeleton
                  animationType="pulse"
                  className={`h-4 w-28 ${skeletonClass}`}
                />
                <Skeleton
                  animationType="pulse"
                  className={`h-8 w-24 rounded-xl ${skeletonClass}`}
                />
              </div>
            ))}
          </Card.Content>
        </Card>

        <Card className="min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <Card.Header className="gap-2 border-b border-slate-100 px-5 py-4">
            <Skeleton
              animationType="pulse"
              className={`h-5 w-48 ${skeletonClass}`}
            />
            <Skeleton
              animationType="pulse"
              className={`h-4 w-56 max-w-full ${skeletonClass}`}
            />
          </Card.Header>

          <Card.Content className="space-y-4 p-5">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton
                  animationType="pulse"
                  className={`h-3 w-24 ${skeletonClass}`}
                />
                <Skeleton
                  animationType="pulse"
                  className={`h-5 w-full ${skeletonClass}`}
                />
              </div>
            ))}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

function EmployeeLoadError({
  error,
  background = false,
  onRetry,
}: {
  error: string | null;
  background?: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-sm font-semibold">
          Data Employee belum dapat dimuat.
        </p>

        {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}

        {background && (
          <p className="mt-1 text-xs text-rose-700">
            Data lama tetap ditampilkan.
          </p>
        )}
      </div>

      <Button
        variant="secondary"
        className="min-h-11 shrink-0 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
        aria-label="Coba lagi memuat data Employee"
        onPress={onRetry}
      >
        Coba lagi
      </Button>
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [adminAction, setAdminAction] = useState<{
    employee: EmployeeAccount;
    action: EmployeeAdminAction;
    reasons: ReturnType<typeof getEmployeeAdminReasons>;
  } | null>(null);

  const { user: currentUser } = useCurrentUser();
  const { employees, pagination, isLoading, isFetching, error, refetch } =
    useEmployeeManagement({
      search,
      source,
      employment,
      account,
      role,
      page,
      limit: 10,
    });

  const [previousResult, setPreviousResult] = useState<{
    employees: EmployeeAccount[];
    pagination: typeof pagination;
  } | null>(null);

  useEffect(() => {
    if (!isFetching && !error) {
      setPreviousResult({ employees, pagination });
    }
  }, [employees, error, isFetching, pagination]);

  const shouldUsePreviousResult =
    Boolean(previousResult) &&
    employees.length === 0 &&
    (isFetching || Boolean(error));

  const visibleEmployees = shouldUsePreviousResult
    ? previousResult!.employees
    : employees;

  const visiblePagination = shouldUsePreviousResult
    ? previousResult!.pagination
    : pagination;

  const isInitialError =
    Boolean(error) && !previousResult && employees.length === 0;

  const isInitialLoading =
    isLoading && !isInitialError && !previousResult && employees.length === 0;

  const hasActiveFilters =
    Boolean(search) ||
    source !== "ALL" ||
    employment !== "ALL" ||
    account !== "ALL" ||
    role !== "ALL";

  const selectedEmployee =
    visibleEmployees.find((employee) => employee.id === selectedEmployeeId) ??
    null;

  useEffect(() => {
    if (selectedEmployeeId === null) {
      if (visibleEmployees.length > 0) {
        setSelectedEmployeeId(visibleEmployees[0].id);
      }

      return;
    }

    if (
      !visibleEmployees.some((employee) => employee.id === selectedEmployeeId)
    ) {
      setSelectedEmployeeId(null);
    }
  }, [selectedEmployeeId, visibleEmployees]);

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

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setSource("ALL");
    setEmployment("ALL");
    setAccount("ALL");
    setRole("ALL");
    setPage(1);
  };

  const handleOpenDetail = (employee: EmployeeAccount) => {
    setSelectedEmployeeId(employee.id);
  };

  const handleAdminAction = (
    employee: EmployeeAccount,
    action: EmployeeAdminAction,
  ) => {
    setAdminAction({
      employee,
      action,
      reasons: getEmployeeAdminReasons(employee, currentUser?.id),
    });
  };

  const accountLabels: Record<Exclude<EmployeeAccountFilter, "ALL">, string> = {
    LINKED: "Sudah tertaut",
    UNLINKED: "Belum tertaut",
    ACTIVE: "Akun aktif",
    INACTIVE: "Akun tidak aktif",
  };

  const activeFilterTags: ActiveFilterTag[] = [
    ...(search
      ? [
          {
            key: "search",
            label: "Cari: " + search,
            onClear: handleClearSearch,
          },
        ]
      : []),
    ...(source !== "ALL"
      ? [
          {
            key: "source",
            label:
              source === "PRESENT"
                ? "Source: Ada di source"
                : "Source: Tidak ada di source",
            onClear: () => handleFilterChange(setSource, "ALL"),
          },
        ]
      : []),
    ...(employment !== "ALL"
      ? [
          {
            key: "employment",
            label:
              employment === "ACTIVE"
                ? "HR: Kepegawaian aktif"
                : "HR: Kepegawaian tidak aktif",
            onClear: () => handleFilterChange(setEmployment, "ALL"),
          },
        ]
      : []),
    ...(account !== "ALL"
      ? [
          {
            key: "account",
            label: "Akun: " + accountLabels[account],
            onClear: () => handleFilterChange(setAccount, "ALL"),
          },
        ]
      : []),
    ...(role !== "ALL"
      ? [
          {
            key: "role",
            label: "Role: " + role,
            onClear: () => handleFilterChange(setRole, "ALL"),
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col gap-6">
      <AppBar
        title="Manajemen Employee & User"
        description="Pantau data Employee HR/Pentaho dan keterkaitannya dengan akun aplikasi"
        showAddButton={false}
      />

      {!isInitialLoading && !isInitialError && (
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
              <SearchFieldGroup className="min-h-11 bg-slate-50 transition-colors duration-200 motion-reduce:transition-none focus-within:ring-2 focus-within:ring-[var(--focus)] focus-within:ring-offset-2">
                <SearchField.SearchIcon />
                <SearchField.Input
                  aria-label="Cari Employee"
                  placeholder="Cari nama atau NIP"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSearch();
                  }}
                />
                <SearchField.ClearButton
                  className="min-h-11 min-w-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                  aria-label="Bersihkan pencarian Employee"
                  onClick={handleClearSearch}
                />
              </SearchFieldGroup>
            </SearchField>

            <Button
              variant="secondary"
              onPress={handleSearch}
              className="min-h-11 shrink-0 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
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
                { id: "ABSENT", label: "Tidak ada di source" },
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
                { id: "ACTIVE", label: "Kepegawaian aktif" },
                { id: "INACTIVE", label: "Kepegawaian tidak aktif" },
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
                { id: "INACTIVE", label: "Akun tidak aktif" },
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

          <div
            className="flex flex-wrap items-center gap-2"
            aria-label="Filter aktif"
          >
            {activeFilterTags.length > 0 && (
              <span className="text-xs font-medium text-slate-500">
                Filter aktif:
              </span>
            )}

            {activeFilterTags.map((tag) => (
              <Button
                key={tag.key}
                variant="ghost"
                size="sm"
                className="min-h-11 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs tabular-nums text-slate-600 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                aria-label={"Hapus " + tag.label}
                onPress={tag.onClear}
              >
                {tag.label} ×
              </Button>
            ))}

            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
              isDisabled={activeFilterTags.length === 0}
              onPress={resetFilters}
            >
              Reset filter
            </Button>
          </div>

          <p className="text-xs tabular-nums text-slate-500">
            {visiblePagination.total} hasil Employee
          </p>
        </Card.Content>
      </Card>
      )}

      {isInitialError ? (
        <EmployeeLoadError error={error} onRetry={() => refetch()} />
      ) : isInitialLoading ? (
        <EmployeeManagementSkeleton />
      ) : (
        <div
          aria-busy={isFetching}
          className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.85fr)]"
        >
          <Card className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <Card.Header className="flex-row items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <Card.Title className="text-base font-semibold text-slate-900">
                  Employee
                </Card.Title>
                <Card.Description>
                  Hasil <span className="tabular-nums">{visiblePagination.total}</span>{" "}
                  data
                </Card.Description>
              </div>

              {isFetching && (
                <p
                  className="text-xs text-sky-700 transition-opacity duration-200 motion-reduce:transition-none"
                  aria-live="polite"
                >
                  Memperbarui…
                </p>
              )}
            </Card.Header>

            <Card.Content className="overflow-x-auto p-0">
              <DataTable<EmployeeAccount>
                column={columns}
                data={visibleEmployees}
                ariaLabel="Daftar Employee dan akun aplikasi"
                pagination={visiblePagination}
                onPageChange={setPage}
                getRowKey={(employee) => employee.id}
                getRowClassName={(employee) =>
                  summarizeEmployeeUi(employee).hasReviewFlag
                    ? "bg-amber-50/40"
                    : undefined
                }
                isPaginationDisabled={isFetching}
                renderEmptyState={() => (
                  <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      {hasActiveFilters
                        ? "Tidak ada Employee yang cocok"
                        : "Belum ada data Employee"}
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-slate-500">
                      {hasActiveFilters
                        ? "Coba ubah filter atau reset filter untuk melihat seluruh data."
                        : "Data Employee belum tersedia untuk ditampilkan."}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="secondary"
                        className="mt-4 min-h-11 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                        onPress={resetFilters}
                      >
                        Reset filter
                      </Button>
                    )}
                  </div>
                )}
                renderCell={(employee, columnKey) => {
                  const needsReview =
                    summarizeEmployeeUi(employee).hasReviewFlag;

                  switch (columnKey) {
                    case "employee":
                      return (
                        <div
                          className={
                            needsReview
                              ? "border-l-2 border-amber-400 pl-3"
                              : undefined
                          }
                        >
                          <p className="font-semibold text-slate-800">
                            {employee.name}
                          </p>
                          <p className="text-xs tabular-nums text-slate-500">
                            NIP {employee.nip}
                          </p>
                        </div>
                      );

                    case "placement":
                      return (
                        <p className="font-medium text-slate-700">
                          {employee.unit?.name ?? "Belum dipetakan"}
                        </p>
                      );

                    case "condition":
                      return (
                        <div className="flex min-w-44 flex-col items-start gap-1.5">
                          <StatusBadge
                            tone={
                              employee.employmentActive ? "success" : "neutral"
                            }
                          >
                            {employee.employmentActive
                              ? "HR aktif"
                              : "HR tidak aktif"}
                          </StatusBadge>
                          <StatusBadge
                            tone={
                              employee.isPresentInSource ? "success" : "danger"
                            }
                          >
                            {employee.isPresentInSource
                              ? "Source tersedia"
                              : "Source tidak tersedia"}
                          </StatusBadge>
                          <StatusBadge
                            tone={employee.picEligible ? "success" : "neutral"}
                          >
                            {employee.picEligible
                              ? "PIC layak"
                              : "PIC tidak layak"}
                          </StatusBadge>
                          <p className="text-xs tabular-nums text-slate-500">
                            {employee.kodeStatpeg}/{employee.statKepeg}
                          </p>
                        </div>
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
                            {employee.user.authProvider} ·{" "}
                            {employee.user.unit?.name ??
                              "Scope belum ditetapkan"}
                          </p>
                        </div>
                      ) : (
                        <StatusBadge tone="neutral">Belum tertaut</StatusBadge>
                      );

                    case "action":
                      return (
                        <div className="flex min-w-44 flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="min-h-11 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                            aria-label={`Lihat detail ${employee.name}`}
                            onPress={() => handleOpenDetail(employee)}
                          >
                            Lihat detail
                          </Button>

                          {getEmployeePicManagementLink(employee) && (
                            <a
                              className="inline-flex min-h-11 items-center rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-200 motion-reduce:transition-none hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2"
                              href={
                                getEmployeePicManagementLink(employee) ??
                                undefined
                              }
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

          <Card
            className="min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-sm"
            aria-labelledby="employee-inspector-heading"
          >
            <Card.Header className="border-b border-slate-100 px-5 py-4">
              <Card.Title
                id="employee-inspector-heading"
                className="text-base font-semibold text-slate-900"
              >
                Inspector Employee
              </Card.Title>
              <Card.Description>
                Detail Employee dan akun aplikasi dari baris yang dipilih.
              </Card.Description>
            </Card.Header>

            <Card.Content className="p-5">
              {selectedEmployee ? (
                <EmployeeDetailPanel
                  employee={selectedEmployee}
                  currentUserId={currentUser?.id}
                  onAction={handleAdminAction}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Belum ada tinjauan
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Pilih “Lihat detail” pada daftar Employee untuk membuka
                    inspector.
                  </p>
                </div>
              )}
            </Card.Content>
          </Card>
        </div>
      )}

      {error && previousResult && !isInitialError && (
        <EmployeeLoadError
          error={error}
          background={visibleEmployees.length > 0}
          onRetry={() => refetch()}
        />
      )}

      <ManageAdminModal
        employee={adminAction?.employee ?? null}
        action={adminAction?.action ?? null}
        reasons={adminAction?.reasons ?? []}
        isOpen={adminAction !== null}
        onClose={() => setAdminAction(null)}
        onSuccess={() => {
          setAdminAction(null);
          refetch();
        }}
      />
    </div>
  );
}
