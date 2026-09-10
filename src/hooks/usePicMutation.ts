import { api } from "@/lib/api";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface PromotePICPayload {
  userId: string;
  unitId: string;
}

interface ToggleStatusPayload {
  userId: string;
  isActive: boolean;
}

interface UsePicMutationOptions {
  onSuccess?: () => void;
}

export function usePicMutation({ onSuccess }: UsePicMutationOptions = {}) {
  const queryClient = useQueryClient();

  const invalidateUserQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["management-users"] });
    queryClient.invalidateQueries({ queryKey: ["units"] });
    queryClient.invalidateQueries({ queryKey: ["employee-management"] });
    onSuccess?.();
  };

  // ADD PIC
  const promoteMutation = useMutation({
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
      toast.success("PIC berhasil ditambahkan");
      invalidateUserQueries();
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan tidak terduga",
      );
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.delete(`/users/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("PIC berhasil dilepas", {
        description: "User tetap tersimpan sebagai VIEWER dan akun dinonaktifkan.",
      });
      invalidateUserQueries();
    },
    onError: (err) => {
      toast.danger("Gagal melepas PIC", {
        description: err instanceof Error ? err.message : "Error",
      });
    },
  });

  // Toggle Status
  const toggleStatusMutation = useMutation({
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
      invalidateUserQueries();
    },
    onError: (error) => {
      toast.danger("Gagal", {
        description: error instanceof Error ? error.message : "Error",
      });
    },
  });

  return {
    //  ADD
    promotePic: promoteMutation.mutate,
    promotePicAsync: promoteMutation.mutateAsync,
    isSubmitting: promoteMutation.isPending,
    submitError: promoteMutation.error
      ? (promoteMutation.error as Error).message
      : null,
    clearError: promoteMutation.reset,

    // DELETE
    deleteUser: deleteMutation.mutate,
    deleteUserAsync: deleteMutation.mutateAsync,
    releasePic: deleteMutation.mutate,
    releasePicAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending
      ? (deleteMutation.variables ?? null)
      : null,

    // Toggle
    toggleStatus: toggleStatusMutation.mutate,
    toggleStatusAsync: toggleStatusMutation.mutateAsync,
    isUpdatingStatus: toggleStatusMutation.isPending
      ? (toggleStatusMutation.variables?.userId ?? null)
      : null,
  };
}
