"use client";

import { api } from "@/lib/api";
import {
  ParticipationImportResult,
  ParticipationImportStats,
  ParticipationPreviewRow,
} from "@/types/participation.types";
import { useCallback, useState } from "react";

const INITIAL_STATS: ParticipationImportStats = {
  total: 0,
  matched: 0,
  conflict: 0,
  unchanged: 0,
  error: 0,
  empty: 0,
};

export function useImportPartisipasi() {
  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [tw, setTw] = useState<number>(1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [previewRows, setPreviewRows] = useState<ParticipationPreviewRow[]>([]);
  const [stats, setStats] = useState<ParticipationImportStats>(INITIAL_STATS);
  const [importResult, setImportResult] =
    useState<ParticipationImportResult | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePreview = useCallback(
    async (selectedFile: File) => {
      if (!categoryId) {
        setErrorMsg("Pilih Kategori Program Budaya terlebih dahulu");
        return;
      }
      setFile(selectedFile);
      setIsLoading(true);
      setErrorMsg(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("categoryId", categoryId);
      formData.append("tw", String(tw));
      formData.append("year", String(year));

      try {
        const res = await api.post("/participation?action=preview", formData, {
          headers: { "Content-Type": undefined },
        });

        const data = res.data;
        setPreviewRows(data.rows as ParticipationPreviewRow[]);
        setStats(data.stats as ParticipationImportStats);
        setStep(2);
      } catch (err: any) {
        setErrorMsg(
          err.response?.data?.message ||
            err.message ||
            "Gagal memproses file Excel",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [categoryId, tw, year],
  );

  const handleProsesImport = useCallback(
    async (overwriteConflictIds: Set<number>) => {
      setStep(3);
      setIsLoading(true);
      setErrorMsg(null);

      const validRowsToCommit = previewRows
        .filter(
          (r) =>
            r.status === "matched" ||
            (r.status === "conflict" && overwriteConflictIds.has(r.id)),
        )
        .map((r) => ({
          unitId: r.unitId!,
          percentage: r.percentage!,
          overwrite:
            r.status === "conflict" ? overwriteConflictIds.has(r.id) : false,
        }));

      try {
        const res = await api.post("/participation?action=commit", {
          categoryId,
          tw,
          year,
          rows: validRowsToCommit,
        });

        setImportResult(res.data.data as ParticipationImportResult);
        setStep(4);
      } catch (err: any) {
        setErrorMsg(
          err.response?.data?.message ||
            err.message ||
            "Gagal melakukan import data",
        );
        setStep(2);
      } finally {
        setIsLoading(false);
      }
    },
    [previewRows, categoryId, tw, year],
  );

  const handleReset = useCallback(() => {
    setStep(1);
    setFile(null);
    setPreviewRows([]);
    setStats(INITIAL_STATS);
    setImportResult(null);
    setErrorMsg(null);
  }, []);

  return {
    step,
    file,
    categoryId,
    tw,
    year,
    previewRows,
    stats,
    importResult,
    isLoading,
    errorMsg,
    setCategoryId,
    setTw,
    setYear,
    handlePreview,
    handleProsesImport,
    handleReset,
  };
}
