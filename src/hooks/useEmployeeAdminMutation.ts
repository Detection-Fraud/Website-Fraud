"use client";

import { api } from "@/lib/api";
import type { EmployeeAdminAction } from "@/lib/employee-management-actions";
import { getEmployeeAdminErrorMessage } from "@/lib/employee-admin-error";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface EmployeeAdminMutationInput {
  employeeId: string;
  action: EmployeeAdminAction;
}

function toBackendAction(action: EmployeeAdminAction) {
  switch (action) {
    case "ENSURE_ADMIN":
    case "PROMOTE_VIEWER":
      return { action: "ENSURE_ADMIN" as const };
    case "ACTIVATE":
      return { action: "SET_ACTIVE" as const, isActive: true };
    case "DEACTIVATE":
      return { action: "SET_ACTIVE" as const, isActive: false };
    case "REVOKE_ADMIN":
      return { action: "REVOKE_ADMIN" as const };
  }
}

export function useEmployeeAdminMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ employeeId, action }: EmployeeAdminMutationInput) => {
      if (!employeeId) throw new Error("Employee tidak valid");

      const response = await api.patch(
        `/employees/${employeeId}/account`,
        toBackendAction(action),
      );

      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["employee-management"] }),
        queryClient.invalidateQueries({ queryKey: ["management-users"] }),
      ]);
      toast.success("Perubahan akun ADMIN berhasil disimpan");
    },
    onError: (error) => {
      toast.danger("Perubahan akun gagal", {
        description: getEmployeeAdminErrorMessage(error),
      });
    },
  });

  return {
    execute: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error ? getEmployeeAdminErrorMessage(mutation.error) : null,
    reset: mutation.reset,
  };
}
