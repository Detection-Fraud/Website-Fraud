import { api } from "@/lib/api";
import { StatusType } from "@/types/status.types";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
interface ApprovalPayload {
  id: string;
  status: StatusType;
  notes?: string;
}
export function useApproval() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ id, status, notes }: ApprovalPayload) => {
      const res = await api.patch(`/reports/${id}/status`, { status, notes });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.danger(error.message);
      } else {
        toast.danger("Terjadi kesalahan jaringan");
      }
    },
  });

  const handleApprove = async (id: string) => {
    return mutation.mutateAsync({
      id,
      status: "APPROVED",
    });
  };

  const handleReject = async (id: string, notes: string) => {
    return mutation.mutateAsync({ id, status: "REJECTED", notes });
  };

  return {
    isLoading: mutation.isPending,
    handleApprove,
    handleReject,
  };
}
