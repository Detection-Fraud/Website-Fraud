"use client";

import {
  ImportResult,
  ImportStats,
  ImportStep,
  PreviewRow,
} from "@/types/import.types";
import { useCallback, useState } from "react";

const INITIAL_STATS: ImportStats = {
  total: 0,
  baru: 0,
  mutasi: 0,
  tidakBerubah: 0,
  error: 0,
};

export function useImportKaryawan() {
  const [step, setStep] = useState<ImportStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [stats, setStats] = useState<ImportStats>(INITIAL_STATS);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [importProgress, setImportProgress] = useState(0);
  const [processCount, setProcessCount] = useState(0);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setIsLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/users/import?action=preview", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.message ?? "Gagal memproses file");

      setPreviewRows(json.data.rows as PreviewRow[]);
      setStats(json.data.stats as ImportStats);
      setStep(2);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Terjadi kesalahan saat upload",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleProsesImport = useCallback(async () => {
    setStep(3);
    setImportProgress(0);
    setProcessCount(0);
    setErrorMsg(null);

    const totalToProcess = previewRows.filter(
      (r) => r.status === "baru" || r.status === "mutasi",
    ).length;

    let simulated = 0;
    const interval = setInterval(() => {
      simulated += Math.floor(Math.random() * 8) + 4;
      if (simulated >= 90) {
        simulated = 90;
        clearInterval(interval);
      }
      setImportProgress(simulated);
      setProcessCount(Math.floor((simulated / 100) * totalToProcess));
    }, 150);

    try {
      const res = await fetch("/api/users/import?action=commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewRows }),
      });

      const json = await res.json();

      clearInterval(interval);

      if (!res.ok) throw new Error(json.message ?? "Gagal melakukan import");

      setImportProgress(100);
      setProcessCount(totalToProcess);
      setImportResult(json.data as ImportResult);

      setTimeout(() => setStep(4), 600);
    } catch (err: unknown) {
      clearInterval(interval);
      setErrorMsg(
        err instanceof Error ? err.message : "Terjadi kesalahan saat import",
      );
      setStep(2);
    }
  }, [previewRows]);

  const handleReset = useCallback(() => {
    setStep(1);
    setFile(null);
    setPreviewRows([]);
    setStats(INITIAL_STATS);
    setImportResult(null);
    setImportProgress(0);
    setProcessCount(0);
    setErrorMsg(null);
  }, []);

  return {
    step,
    file,
    previewRows,
    stats,
    importResult,
    isLoading,
    errorMsg,
    importProgress,
    processCount,
    setFile,
    handleFileSelect,
    handleProsesImport,
    handleReset,
  };
}
