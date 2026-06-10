import { useState } from "react";

interface PromotePICPayload {
  userId: string;
  unitId: string;
}

interface UseAddPICOptions {
  onSuccess?: () => void;
}

export function useAddPic({ onSuccess }: UseAddPICOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const promotePic = async (payload: PromotePICPayload) => {
    if (!payload.userId || !payload.unitId) {
      setSubmitError("Mohon pilih user dan unit terlebih dahulu");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const res = await fetch(`/api/users/${payload.userId}/promote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: payload.unitId,
        }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.message || "Gagal mempromote user");

      onSuccess?.();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Terjadi kesalahan tidak terduga",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearError = () => setSubmitError(null);

  return {
    promotePic,
    isSubmitting,
    submitError,
    clearError,
  };
}
