import { api } from "@/lib/api";
import { ChangePasswordInput } from "@/schemas/user.schema";
import { toast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { signOut } from "next-auth/react";

export function useChangePassword() {
  const {
    mutateAsync: changePassword,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: async (payload: ChangePasswordInput) => {
      const res = await api.patch("/users/change-password", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Password Diperbarui", {
        description: data.message || "Password berhasil diubah",
      });

      setTimeout(() => {
        // Logout user agar JWT token dan session lama dihapus.
        // User dipaksa login dengan password baru,
        // dan session baru akan memiliki passwordChangedAt yang terbaru dari DB.
        signOut({ callbackUrl: "/login" });
      }, 1500);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        "Gagal memperbarui password. Coba lagi";

      toast.danger("Gagal", {
        description: message,
      });
    },
  });

  return {
    changePassword,
    isPending,
    isSuccess,
  };
}
