import { api } from "@/lib/api";
import { StatusType } from "@/types/status.types";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

type ReviewStatus = Extract<StatusType, "APPROVED" | "REJECTED">;

interface ApprovalPayload {
  id: string;
  status: ReviewStatus;
  notes?: string;
  percentage?: number;
}

interface ApprovalErrorBody {
  message?: string;
}

export interface ApprovalResult {
  reportId: string;
  status: ReviewStatus;
  nextAction: null;
}

export function useApproval() {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    ApprovalResult,
    AxiosError<ApprovalErrorBody>,
    ApprovalPayload
  >({
    mutationFn: async ({ id, status, notes, percentage }) => {
      const response = await api.patch<ApprovalResult>(
        `/reports/${id}/status`,
        { status, notes, percentage },
      );
      return response.data;
    },
    onSuccess: async (_result, { id }) => {
      toast.success("Status approval berhasil diperbarui");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
        queryClient.invalidateQueries({ queryKey: ["report-detail", id] }),
      ]);
    },
    onError: (error) => {
      toast.danger(
        error.response?.data?.message ||
          error.message ||
          "Terjadi kesalahan jaringan",
      );
    },
  });

  const handleApprove = (id: string, percentage?: number) =>
    mutation.mutateAsync({ id, status: "APPROVED", percentage });

  const handleReject = (id: string, notes: string) =>
    mutation.mutateAsync({ id, status: "REJECTED", notes });

  return {
    isLoading: mutation.isPending,
    handleApprove,
    handleReject,
  };
}
