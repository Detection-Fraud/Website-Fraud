import { api } from "@/lib/api";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface ToggleStatusPayload {
  userId: string;
  isActive: boolean;
}

interface UseTogglePicStatusOptions {
  onSuccess?: () => void;
}

export function useTogglePicStatus({
  onSuccess,
}: UseTogglePicStatusOptions = {}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: ToggleStatusPayload) => {
      const res = await api.patch(`/users/${payload.userId}/status`, {
        isActive: payload.isActive,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Berhasil", {
        description: data.message || "Status berhasil diubah",
      });
      queryClient.invalidateQueries({ queryKey: ["management-users"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.danger("Gagal", {
        description:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan tidak terduga",
      });
    },
  });

  return {
    isUpdating: mutation.isPending
      ? (mutation.variables?.userId ?? null)
      : null,
    toggleStatus: mutation.mutate,
  };
}
