"use client";

import { api } from "@/lib/api";
import type {
  EmployeeImportImpact,
} from "@/schemas/employee-import.schema";
import type { EmployeeSyncStatusResponse } from "@/schemas/employee-sync.schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

export type EmployeeImportPreview = {
  previewToken: string;
  expiresAt: string;
  rowCount: number;
  impact: EmployeeImportImpact;
};

export type EmployeeImportResult = {
  runId: string;
  sourceSystem: "PENTAHO";
  channel: "EXCEL_IMPORT";
  status: "SUCCEEDED" | "FAILED";
  receivedCount: number;
  processedCount: number;
  missingCount: number;
  deactivatedCount: number;
};

export type EmployeeIntakeTab = "pentaho" | "excel";

type ApiError = { response?: { status?: number } };
type QueryClient = ReturnType<typeof useQueryClient>;

export function isAmbiguousEmployeeImportCommitError(error: unknown): boolean {
  const status = (error as ApiError | null)?.response?.status;
  return status === undefined || status === 408 || status >= 500;
}

export function confirmsNewSuccessfulEmployeeExcelRun(
  status: EmployeeSyncStatusResponse | null | undefined,
  previousRunId: string | null,
): boolean {
  return Boolean(
    status?.channel === "EXCEL_IMPORT" &&
    status.status === "SUCCEEDED" &&
    status.runId !== previousRunId,
  );
}

export function getEmployeeExcelRecoveryAction(
  status: EmployeeSyncStatusResponse | null | undefined,
  candidateRunId: string,
): "POLL" | "INVALIDATE" | "STOP" {
  if (!status || status.runId !== candidateRunId || status.channel !== "EXCEL_IMPORT") return "STOP";
  if (status.status === "RUNNING") return "POLL";
  return status.status === "SUCCEEDED" ? "INVALIDATE" : "STOP";
}

function fetchEmployeeSyncStatus() {
  return api.get<EmployeeSyncStatusResponse | null>("/employees/sync").then((response) => response.data);
}

const backgroundRecoveries = new Map<string, Promise<void>>();
const invalidatedExcelRuns = new Set<string>();
const EXCEL_RECOVERY_POLL_MS = 3000;
const EXCEL_RECOVERY_DISCOVERY_MS = 60_000;
const EXCEL_RECOVERY_MAX_MS = 10 * 60_000;

async function refreshSyncStatus(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: ["employee-sync-status"],
    queryFn: fetchEmployeeSyncStatus,
    staleTime: 0,
    retry: false,
  });
}

async function invalidateSuccessfulExcelRun(queryClient: QueryClient, runId: string) {
  if (invalidatedExcelRuns.has(runId)) return;
  invalidatedExcelRuns.add(runId);
  try {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["employee-management"] }),
      queryClient.invalidateQueries({ queryKey: ["management-users"] }),
      queryClient.invalidateQueries({ queryKey: ["participation-ranking"] }),
      queryClient.invalidateQueries({ queryKey: ["participation-reports"] }),
    ]);
  } catch {
    invalidatedExcelRuns.delete(runId);
  }
}

async function recoverAmbiguousCommitNow(queryClient: QueryClient, previousRunId: string | null) {
  const startedAt = Date.now();
  const hardDeadline = startedAt + EXCEL_RECOVERY_MAX_MS;
  let candidateRunId: string | null = null;
  let deadline = startedAt + EXCEL_RECOVERY_DISCOVERY_MS;

  while (Date.now() < deadline) {
    let latest: EmployeeSyncStatusResponse | null;
    try {
      latest = await refreshSyncStatus(queryClient);
    } catch {
      await queryClient.invalidateQueries({ queryKey: ["employee-sync-status"], refetchType: "active" });
      await new Promise((resolve) => setTimeout(resolve, EXCEL_RECOVERY_POLL_MS));
      continue;
    }

    if (!candidateRunId) {
      if (!latest) {
        await new Promise((resolve) => setTimeout(resolve, EXCEL_RECOVERY_POLL_MS));
        continue;
      }
      if (latest.runId === previousRunId) {
        if (latest.status === "RUNNING") return;
        await new Promise((resolve) => setTimeout(resolve, EXCEL_RECOVERY_POLL_MS));
        continue;
      }
      if (latest.channel !== "EXCEL_IMPORT") return;

      candidateRunId = latest.runId;
      const runDeadline = latest.deadlineAt ? Date.parse(latest.deadlineAt) : Number.NaN;
      const recoveryDeadline = Number.isFinite(runDeadline)
        ? Math.max(Date.now() + 60_000, runDeadline + 60_000)
        : hardDeadline;
      deadline = Math.min(hardDeadline, recoveryDeadline);
    }

    const action = getEmployeeExcelRecoveryAction(latest, candidateRunId);
    if (action === "INVALIDATE") {
      await invalidateSuccessfulExcelRun(queryClient, candidateRunId);
      return;
    }
    if (action === "STOP") return;

    await new Promise((resolve) => setTimeout(resolve, Math.min(EXCEL_RECOVERY_POLL_MS, deadline - Date.now())));
  }

  await queryClient.invalidateQueries({ queryKey: ["employee-sync-status"], refetchType: "active" });
}

function recoverAmbiguousCommit(queryClient: QueryClient, previousRunId: string | null) {
  const recoveryKey = previousRunId ?? "NO_PREVIOUS_RUN";
  const existing = backgroundRecoveries.get(recoveryKey);
  if (existing) return existing;
  const recovery = recoverAmbiguousCommitNow(queryClient, previousRunId)
    .catch(() => queryClient.invalidateQueries({ queryKey: ["employee-sync-status"], refetchType: "active" }))
    .finally(() => backgroundRecoveries.delete(recoveryKey));
  backgroundRecoveries.set(recoveryKey, recovery);
  return recovery;
}

export function isEmployeeSyncRunActive(
  status: EmployeeSyncStatusResponse | null | undefined,
): boolean {
  return status?.status === "RUNNING";
}

export function shouldAdvanceEmployeePentahoRun(
  status: EmployeeSyncStatusResponse | null | undefined,
): status is EmployeeSyncStatusResponse {
  return status?.status === "RUNNING" && status.channel === "PENTAHO";
}

export function getEmployeeImportErrorMessage(
  error: unknown,
  action: "preview" | "commit" | "start" | "status" = "preview",
): string {
  const status = (error as ApiError | null)?.response?.status;
  if (status === 401 || status === 403) return "Sesi Admin tidak memiliki akses. Muat ulang halaman dan masuk kembali.";
  if (status === 409) {
    return action === "start" || action === "status"
      ? "Proses snapshot lain sedang berjalan atau statusnya berubah. Periksa status terbaru sebelum melanjutkan."
      : "Status snapshot berubah atau preview sudah tidak berlaku. Pilih file dan buat preview baru.";
  }
  if (status === 413) return "Ukuran workbook melewati batas 25 MiB.";
  if (status === 429) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (status === 400 && action !== "start" && action !== "status") return "Workbook tidak sesuai template atau berisi data yang tidak valid.";
  if (action === "start" || action === "status") return "Status sinkronisasi belum dapat diperbarui. Coba lagi sebentar.";
  return action === "commit"
    ? "Import belum berhasil. Preview tetap aman; periksa status dan coba dengan preview baru bila diperlukan."
    : "File belum dapat dipreview. Pastikan memakai template Employee XLSX yang resmi.";
}

export function buildEmployeeImportPreviewFormData(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

export function buildEmployeeImportCommitFormData(file: File, previewToken: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("previewToken", previewToken);
  form.append("confirmFullSnapshot", "true");
  return form;
}

function invalidateSnapshotQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["employee-management"] }),
    queryClient.invalidateQueries({ queryKey: ["management-users"] }),
    queryClient.invalidateQueries({ queryKey: ["participation-ranking"] }),
    queryClient.invalidateQueries({ queryKey: ["participation-reports"] }),
    queryClient.invalidateQueries({ queryKey: ["employee-sync-status"] }),
  ]);
}

export function useImportKaryawan() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<EmployeeIntakeTab>("pentaho");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [confirmedFullSnapshot, setConfirmedFullSnapshot] = useState(false);
  const [result, setResult] = useState<EmployeeImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewExpired, setPreviewExpired] = useState(false);
  const [isCheckingCommitStatus, setIsCheckingCommitStatus] = useState(false);
  const fileVersion = useRef(0);
  const commitPreflight = useRef(false);
  const advancingRun = useRef<string | null>(null);
  const lastAdvanceAt = useRef<{ runId: string; at: number } | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceMutationRef = useRef<(runId: string) => void>(() => undefined);
  const mounted = useRef(false);

  const statusQuery = useQuery<EmployeeSyncStatusResponse | null>({
    queryKey: ["employee-sync-status"],
    queryFn: fetchEmployeeSyncStatus,
    refetchOnMount: "always",
    refetchInterval: (query) => {
      const latest = query.state.data;
      return latest?.status === "RUNNING" && latest.channel === "EXCEL_IMPORT" ? 3000 : false;
    },
    retry: false,
  });
  const status = statusQuery.data;
  const hasActiveRun = isEmployeeSyncRunActive(status);

  const startMutation = useMutation<EmployeeSyncStatusResponse, unknown, void>({
    mutationFn: () => api.post<EmployeeSyncStatusResponse>("/employees/sync").then((response) => response.data),
    retry: false,
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(["employee-sync-status"], nextStatus);
      await queryClient.invalidateQueries({ queryKey: ["employee-sync-status"] });
    },
    onError: async (error) => {
      setErrorMsg(getEmployeeImportErrorMessage(error, "start"));
      await queryClient.invalidateQueries({ queryKey: ["employee-sync-status"] });
    },
  });

  const advanceMutation = useMutation<EmployeeSyncStatusResponse, unknown, string>({
    mutationFn: (runId) => api.post<EmployeeSyncStatusResponse>(`/employees/sync/${runId}/advance`).then((response) => response.data),
    retry: false,
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(["employee-sync-status"], nextStatus);
      if (nextStatus.status === "SUCCEEDED") await invalidateSnapshotQueries(queryClient);
    },
    onSettled: async (_data, error, runId) => {
      advancingRun.current = null;
      if (error) await queryClient.invalidateQueries({ queryKey: ["employee-sync-status"] });
      if (!mounted.current) return;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        const latest = queryClient.getQueryData<EmployeeSyncStatusResponse | null>(["employee-sync-status"]);
        if (latest?.runId !== runId || !shouldAdvanceEmployeePentahoRun(latest) || advancingRun.current) return;
        advancingRun.current = runId;
        lastAdvanceAt.current = { runId, at: Date.now() };
        advanceMutationRef.current(runId);
      }, 3000);
    },
    onError: (error) => setErrorMsg(getEmployeeImportErrorMessage(error, "status")),
  });
  const advancePentahoRun = advanceMutation.mutate;
  useEffect(() => {
    advanceMutationRef.current = advancePentahoRun;
  }, [advancePentahoRun]);

  useEffect(() => {
    if (!shouldAdvanceEmployeePentahoRun(status) || advancingRun.current === status.runId) return;
    if (lastAdvanceAt.current?.runId === status.runId && Date.now() - lastAdvanceAt.current.at < 3000) return;
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    advancingRun.current = status.runId;
    lastAdvanceAt.current = { runId: status.runId, at: Date.now() };
    advancePentahoRun(status.runId);
  }, [status, advancePentahoRun]);

  useEffect(() => () => {
    mounted.current = false;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);
  useEffect(() => {
    mounted.current = true;
  }, []);

  const previewMutation = useMutation<EmployeeImportPreview, unknown, File>({
    mutationFn: async (selectedFile) => {
      const form = buildEmployeeImportPreviewFormData(selectedFile);
      const response = await api.post<EmployeeImportPreview>("/employees/import/preview", form);
      return response.data;
    },
    retry: false,
    onError: async (error) => {
      if ((error as ApiError | null)?.response?.status === 409) {
        await queryClient.invalidateQueries({ queryKey: ["employee-sync-status"] });
      }
    },
  });
  const previewFile = previewMutation.mutateAsync;

  const commitMutation = useMutation<EmployeeImportResult, unknown, { file: File; previewToken: string; fileVersion: number; previousRunId: string | null }>({
    mutationFn: async ({ file: selectedFile, previewToken }) => {
      const form = buildEmployeeImportCommitFormData(selectedFile, previewToken);
      const response = await api.post<EmployeeImportResult>("/employees/import/commit", form);
      return response.data;
    },
    retry: false,
    onSuccess: async (nextResult, variables) => {
      if (variables.fileVersion === fileVersion.current) {
        setResult(nextResult);
        setPreview(null);
        setConfirmedFullSnapshot(false);
      }
      if (nextResult.status === "SUCCEEDED") await invalidateSnapshotQueries(queryClient);
      else await queryClient.invalidateQueries({ queryKey: ["employee-sync-status"] });
    },
    onError: async (error, variables) => {
      if (isAmbiguousEmployeeImportCommitError(error)) {
        void recoverAmbiguousCommit(queryClient, variables.previousRunId);
      }
    },
  });
  const commitSnapshot = commitMutation.mutateAsync;

  useEffect(() => {
    if (!preview) {
      setPreviewExpired(false);
      return;
    }
    const expiresAt = Date.parse(preview.expiresAt);
    const timeout = window.setTimeout(() => {
      setPreview(null);
      setConfirmedFullSnapshot(false);
      setPreviewExpired(true);
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [preview]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const version = ++fileVersion.current;
    setFile(selectedFile);
    setPreview(null);
    setConfirmedFullSnapshot(false);
    setResult(null);
    setPreviewExpired(false);
    setErrorMsg(null);
    try {
      const data = await previewFile(selectedFile);
      if (version === fileVersion.current) setPreview(data);
    } catch (error) {
      if (version === fileVersion.current) setErrorMsg(getEmployeeImportErrorMessage(error, "preview"));
    }
  }, [previewFile]);

  const handleCommit = useCallback(async () => {
    if (!file || !preview || hasActiveRun || !confirmedFullSnapshot || commitPreflight.current || commitMutation.isPending) return;
    if (Date.parse(preview.expiresAt) <= Date.now()) {
      setPreview(null);
      setConfirmedFullSnapshot(false);
      setPreviewExpired(true);
      return;
    }
    setErrorMsg(null);
    const version = fileVersion.current;
    commitPreflight.current = true;
    setIsCheckingCommitStatus(true);
    try {
      let latestStatus: EmployeeSyncStatusResponse | null;
      try {
        await queryClient.cancelQueries({ queryKey: ["employee-sync-status"] });
        latestStatus = await fetchEmployeeSyncStatus();
      } catch (error) {
        setErrorMsg(getEmployeeImportErrorMessage(error, "status"));
        await queryClient.invalidateQueries({ queryKey: ["employee-sync-status"], refetchType: "active" });
        return;
      }
      queryClient.setQueryData(["employee-sync-status"], latestStatus);
      if (isEmployeeSyncRunActive(latestStatus)) {
        setErrorMsg("Proses snapshot sedang berjalan. Commit ditahan; tunggu hingga proses selesai sebelum mencoba lagi.");
        return;
      }
      if (Date.parse(preview.expiresAt) <= Date.now()) {
        setPreview(null);
        setConfirmedFullSnapshot(false);
        setPreviewExpired(true);
        return;
      }
      await commitSnapshot({
        file,
        previewToken: preview.previewToken,
        fileVersion: version,
        previousRunId: latestStatus?.runId ?? null,
      });
    } catch (error) {
      if (version !== fileVersion.current) return;
      setErrorMsg(getEmployeeImportErrorMessage(error, "commit"));
      if ((error as ApiError | null)?.response?.status === 409) {
        setPreview(null);
        setConfirmedFullSnapshot(false);
      }
    } finally {
      commitPreflight.current = false;
      setIsCheckingCommitStatus(false);
    }
  }, [file, preview, hasActiveRun, confirmedFullSnapshot, commitSnapshot, commitMutation.isPending, queryClient]);

  return {
    activeTab,
    setActiveTab,
    file,
    preview,
    result,
    status,
    statusLoading: statusQuery.isLoading,
    statusError: statusQuery.isError,
    hasActiveRun,
    errorMsg,
    previewExpired,
    confirmedFullSnapshot,
    setConfirmedFullSnapshot,
    isStarting: startMutation.isPending,
    isPreviewing: previewMutation.isPending,
    isCommitting: isCheckingCommitStatus || commitMutation.isPending,
    isCheckingCommitStatus,
    startPentaho: () => { setErrorMsg(null); startMutation.mutate(); },
    handleFileSelect,
    handleCommit,
    retryStatus: () => statusQuery.refetch(),
  };
}
