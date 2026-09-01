import { api } from "@/lib/api";
import { ParticipationScoreInput } from "@/schemas/participation-score.schema";
import { toast } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ParticipationScoreHistoryItem {
  id: string;
  action: "CREATED" | "UPDATED";
  previousPercentage: number | null;
  newPercentage: number;
  changeReason: string | null;
  actorId: string | null;
  actorName: string;
  createdAt: string;
}

export interface ParticipationAssessmentData {
  id: string;
  percentage: number | null;
  tw: number;
  year: number;
  unitId: string;
  evidenceReportId: string | null;
  assessedAt: string | null;
  assessedBy: { id: string; name: string } | null;
  updatedAt: string;
  scoreHistories: ParticipationScoreHistoryItem[];
}

export interface ParticipationScoreData {
  scoreStatus: "MENUNGGU_NILAI" | "SUDAH_DINILAI";
  assessment: ParticipationAssessmentData | null;
}

export interface ParticipationScoreMutationResult {
  status: "CREATED" | "UPDATED" | "UNCHANGED";
  participationDataId: string;
  percentage: number;
  historyId?: string;
}

type ApiError = {
  response?: { status?: number; data?: { message?: string } };
  message?: string;
};

function getErrorMessage(error: unknown): string {
  const apiError = error as ApiError;
  return (
    apiError.response?.data?.message ||
    apiError.message ||
    "Gagal menyimpan nilai"
  );
}

export function useParticipationScore(reportId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<ParticipationScoreData>({
    queryKey: ["participation-score", reportId],
    queryFn: () =>
      api
        .get<ParticipationScoreData>(
          `/reports/${reportId}/participation-score`,
        )
        .then((res) => res.data),
    enabled: Boolean(reportId),
    retry: false,
  });

  const mutation = useMutation<
    ParticipationScoreMutationResult,
    unknown,
    ParticipationScoreInput
  >({
    mutationFn: (data) =>
      api
        .put<ParticipationScoreMutationResult>(
          `/reports/${reportId}/participation-score`,
          data,
        )
        .then((res) => res.data),
    retry: false,
    onSuccess: async () => {
      toast.success("Nilai partisipasi berhasil disimpan");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["participation-score", reportId],
        }),
        queryClient.invalidateQueries({ queryKey: ["report-detail", reportId] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
        queryClient.invalidateQueries({ queryKey: ["approval-list"] }),
        queryClient.invalidateQueries({ queryKey: ["participation-reports"] }),
      ]);
    },
    onError: async (error) => {
      const apiError = error as ApiError;
      if (apiError.response?.status === 409) {
        await queryClient.refetchQueries({
          queryKey: ["participation-score", reportId],
          type: "active",
        });
        toast.danger(
          "Data nilai berubah oleh administrator lain. Tinjau ulang nilai terbaru.",
        );
        return;
      }
      toast.danger(getErrorMessage(error));
    },
  });

  return {
    scoreData: query.data,
    scoreError: query.error,
    refetchScore: query.refetch,
    isLoadingScore: query.isLoading,
    saveScore: mutation.mutateAsync,
    isSavingScore: mutation.isPending,
  };
}
