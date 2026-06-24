import { api } from "@/lib/api";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function useDeletePic({ onSuccess }: { onSuccess?: () => void } = {}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.delete(`/users/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["management-users"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.danger("Gagal", {
        description: err instanceof Error ? err.message : "Error",
      });
    },
  });

  return {
    deleteUser: mutation.mutate,
    isDeleting: mutation.isPending ? (mutation.variables ?? null) : null,
  };
}
