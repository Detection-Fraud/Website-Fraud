"use client";

import { api } from "@/lib/api";
import {
  ParticipationImportResult,
  ParticipationImportStats,
  ParticipationPreviewRow,
} from "@/types/participation.types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [tw, setTw] = useState<number>(1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [previewRows, setPreviewRows] = useState<ParticipationPreviewRow[]>([]);
  const [stats, setStats] = useState<ParticipationImportStats>(INITIAL_STATS);
  const [importResult, setImportResult] =
    useState<ParticipationImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("categoryId", categoryId);
      formData.append("tw", String(tw));
      formData.append("year", String(year));

      const res = await api.post("/participation?action=preview", formData, {
        headers: { "Content-Type": undefined },
      });
      return res.data as {
        rows: ParticipationPreviewRow[];
        stats: ParticipationImportStats;
      };
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (
      rows: Array<{
        unitId: string;
        percentage: number;
        overwrite: boolean;
      }>,
    ) => {
      const res = await api.post("/participation?action=commit", {
        categoryId,
        tw,
        year,
        rows,
      });
      return res.data as ParticipationImportResult;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["participation-ranking"] }),
        queryClient.invalidateQueries({ queryKey: ["participation-reports"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
  });

  const handlePreview = useCallback(
    async (selectedFile: File) => {
      if (!categoryId) {
        setErrorMsg("Pilih Kategori Program Budaya terlebih dahulu");
        return;
      }
      setFile(selectedFile);
      setErrorMsg(null);

      try {
        const data = await previewMutation.mutateAsync(selectedFile);
        setPreviewRows(data.rows);
        setStats(data.stats);
        setStep(2);
      } catch (err: any) {
        setErrorMsg(
          err.response?.data?.message ||
            err.message ||
            "Gagal memproses file Excel",
        );
      }
    },
    [categoryId, previewMutation],
  );

  const handleProsesImport = useCallback(
    async (overwriteConflictIds: Set<number>) => {
      setStep(3);
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
        const data = await commitMutation.mutateAsync(validRowsToCommit);
        setImportResult(data);
        setStep(4);
      } catch (err: any) {
        setErrorMsg(
          err.response?.data?.message ||
            err.message ||
            "Gagal melakukan import data",
        );
        setStep(2);
      }
    },
    [commitMutation, previewRows],
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
    isLoading: previewMutation.isPending || commitMutation.isPending,
    errorMsg,
    setCategoryId,
    setTw,
    setYear,
    handlePreview,
    handleProsesImport,
    handleReset,
  };
}
