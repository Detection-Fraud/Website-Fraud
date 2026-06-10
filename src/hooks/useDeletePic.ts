import { toast } from "@heroui/react";
import { useState } from "react";

export function useDeletePic({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const deleteUser = async (userId: string) => {
    try {
      setIsDeleting(userId);
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.message || "Gagal menghapus user");

      toast.success("Berhasil dihapus");
      onSuccess?.();
    } catch (err) {
      toast.danger("Gagal", {
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  return { deleteUser, isDeleting };
}
