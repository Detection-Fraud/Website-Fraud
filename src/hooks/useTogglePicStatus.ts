import { toast } from "@heroui/react";
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
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const toggleStatus = async (payload: ToggleStatusPayload) => {
    try {
      setIsUpdating(payload.userId);

      const res = await fetch(`/api/users/${payload.userId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: payload.isActive,
        }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.message || "Gagal mengubah status PIC");

      toast.success("Berhasil", {
        description: json.message || "Status berhasil diubah",
      });

      onSuccess?.();
    } catch (err) {
      toast.danger("Gagal", {
        description:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan tidak terduga",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  return {
    isUpdating,
    toggleStatus,
  };
}
