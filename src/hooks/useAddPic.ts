import { api } from "@/lib/api";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface PromotePICPayload {
  userId: string;
  unitId: string;
}

interface UseAddPICOptions {
  onSuccess?: () => void;
}

export function useAddPic({ onSuccess }: UseAddPICOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: PromotePICPayload) => {
      if (!payload.userId || !payload.unitId) {
        throw new Error("Mohon pilih user dan unit terlebih dahulu");
      }
      const res = await api.patch(`/users/${payload.userId}/promote`, {
        unitId: payload.unitId,
      });
      return res.data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-users"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("PIC berhasil ditambahkan");
      onSuccess?.();
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan tidak terduga",
      );
    },
  });

  return {
    promotePic: mutation.mutate,
    isSubmitting: mutation.isPending,
    submitError: mutation.error ? (mutation.error as Error).message : null,
    clearError: mutation.reset, // reset mutation state (error, data, dll)
  };
}
