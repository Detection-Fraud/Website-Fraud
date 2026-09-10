"use client";

import { api } from "@/lib/api";
import {
  buildParticipationCommitPlan,
  getParticipationErrorMessage,
} from "@/lib/participation-ui";
import { toLegacyParticipationPreview } from "@/lib/participation-adapter";
import type {
  ParticipationImportResult,
  ParticipationImportStats,
  ParticipationPreviewRow,
  ParticipationWorkbookCommitResult,
  ParticipationWorkbookPreview,
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
  first: 0,
  correction: 0,
};

export function useImportPartisipasi() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [tw, setTw] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());

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
      return res.data as ParticipationWorkbookPreview;
    },
  });

  const commitMutation = useMutation({
    mutationFn: async ({
      selectedFile,
      corrections,
    }: {
      selectedFile: File;
      corrections: Array<{
        unitCode: string;
        overwrite: true;
        reason: string;
        expectedUpdatedAt: string;
      }>;
    }) => {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("categoryId", categoryId);
      formData.append("tw", String(tw));
      formData.append("year", String(year));
      formData.append("corrections", JSON.stringify(corrections));

      const res = await api.post("/participation?action=commit", formData, {
        headers: { "Content-Type": undefined },
      });

      return res.data as ParticipationWorkbookCommitResult;
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
      if (previewMutation.isPending || commitMutation.isPending) return;
      if (!categoryId) {
        setErrorMsg("Pilih Kategori Program Budaya terlebih dahulu");
        return;
      }
      setFile(selectedFile);
      setPreviewRows([]);
      setStats(INITIAL_STATS);
      setImportResult(null);
      setErrorMsg(null);

      try {
        const data = toLegacyParticipationPreview(
          await previewMutation.mutateAsync(selectedFile),
        );
        setPreviewRows(data.rows);
        setStats(data.stats);
        setStep(2);
      } catch (error: unknown) {
        setErrorMsg(getParticipationErrorMessage(error));
        setStep(1);
      }
    },
    [categoryId, commitMutation.isPending, previewMutation],
  );

  const handleProsesImport = useCallback(
    async (
      correctionsConfirmed: boolean,
      correctionReasons: Record<number, string>,
    ) => {
      if (previewMutation.isPending || commitMutation.isPending) return;

      const plan = buildParticipationCommitPlan(
        previewRows,
        correctionsConfirmed,
        correctionReasons,
      );

      if (plan.error) {
        setErrorMsg(plan.error);
        setStep(2);
        return;
      }

      if (!file) {
        setErrorMsg("File import tidak tersedia");
        setStep(2);
        return;
      }

      try {
        setStep(3);
        const data = await commitMutation.mutateAsync({
          selectedFile: file,
          corrections: plan.corrections,
        });
        setImportResult(data);
        setStep(4);
      } catch (error: unknown) {
        setErrorMsg(getParticipationErrorMessage(error));
        setStep(2);
      }
    },
    [commitMutation, file, previewMutation.isPending, previewRows],
  );

  const handleReset = useCallback(() => {
    if (previewMutation.isPending || commitMutation.isPending) return;
    setStep(1);
    setFile(null);
    setPreviewRows([]);
    setStats(INITIAL_STATS);
    setImportResult(null);
    setErrorMsg(null);
  }, [commitMutation.isPending, previewMutation.isPending]);

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
