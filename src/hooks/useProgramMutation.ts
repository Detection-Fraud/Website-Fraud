import { api } from "@/lib/api";
import type { ProgramBudayaWithCategory } from "@/hooks/useProgramQuery";
import { toast, useOverlayState } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type ProgramBannerState = "NONE" | "UNCHANGED" | "REPLACED" | "REMOVED";

interface ProgramPayload {
  name: string;
  frequency: number;
  tw: number;
  startDate: string;
  endDate: string;
  uploadDeadline: string;
  isActive: boolean;
  categoryId?: string | null;
  description?: string | null;
  bannerState?: ProgramBannerState;
  bannerUrl?: string | null;
  bannerPublicId?: string;
  bannerDescriptor?: string;
  bannerCleanupToken?: string;
  expectedUpdatedAt?: string;
}

type ApiError = {
  response?: { data?: { message?: string } };
  message?: string;
};

function getErrorMessage(error: unknown) {
  const apiError = error as ApiError;
  return (
    apiError.response?.data?.message || apiError.message || "Unknown error"
  );
}

export function useProgramMutation() {
  const queryClient = useQueryClient();
  const modalState = useOverlayState();
  const modalAddState = useOverlayState();
  const [selectedProgram, setSelectedProgram] = useState<ProgramBudayaWithCategory | null>(
    null,
  );

  const invalidateProgramQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["programs"] }),
      queryClient.invalidateQueries({ queryKey: ["program-list"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["program-categories"] }),
      queryClient.invalidateQueries({ queryKey: ["program-periods"] }),
      queryClient.invalidateQueries({ queryKey: ["pic-dashboard"] }),
    ]);

  const saveMutation = useMutation({
    mutationFn: ({
      payload,
      programId,
    }: {
      payload: ProgramPayload;
      programId?: string;
    }) =>
      programId
        ? api.put(`/programs/${programId}`, payload)
        : api.post("/programs", payload),
    onSuccess: async (_data, variables) => {
      await invalidateProgramQueries();
      if (variables.programId) {
        toast.success("Program berhasil diperbarui");
      } else {
        toast.success("Program berhasil ditambahkan");
      }
    },
    onError: (error: unknown, variables) => {
      const action = variables.programId ? "memperbarui" : "menambahkan";
      toast.danger(`Gagal ${action} program: ` + getErrorMessage(error));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      programId,
      isActive,
      expectedUpdatedAt,
    }: {
      programId: string;
      isActive: boolean;
      expectedUpdatedAt: string;
    }) => api.patch(`/programs/${programId}`, { isActive, expectedUpdatedAt }),
    onSuccess: async (_data, variables) => {
      await invalidateProgramQueries();
      modalState.close();
      toast.success(
        variables.isActive
          ? "Program berhasil diaktifkan"
          : "Program berhasil dinonaktifkan",
      );
    },
    onError: (error: unknown, variables) => {
      const action = variables.isActive ? "mengaktifkan" : "menonaktifkan";
      toast.danger(`Gagal ${action} program: ` + getErrorMessage(error));
    },
  });

  const handleAddToggleClick = () => {
    setSelectedProgram(null);
    modalAddState.open();
  };

  const handleEditToggleClick = (program: ProgramBudayaWithCategory) => {
    setSelectedProgram(program);
    modalAddState.open();
  };

  const handleToggleClick = (program: ProgramBudayaWithCategory) => {
    setSelectedProgram(program);
    modalState.open();
  };

  const handleAddProgram = async (formData: FormData) => {
    const bannerState = String(
      formData.get("bannerState") || "NONE",
    ) as ProgramBannerState;

    const payload: ProgramPayload = {
      name: String(formData.get("name") || ""),
      frequency: Number(formData.get("frequency")),
      tw: Number(formData.get("tw")),
      startDate: String(formData.get("startDate") || ""),
      endDate: String(formData.get("endDate") || ""),
      uploadDeadline: String(formData.get("uploadDeadline") || ""),
      isActive: true,
      categoryId: String(formData.get("categoryId") || "") || null,
      description: String(formData.get("description") || "") || null,
      bannerState,
    };

    if (bannerState === "REPLACED") {
      payload.bannerUrl = String(formData.get("bannerUrl") || "");
      payload.bannerPublicId = String(
        formData.get("bannerPublicId") || "",
      );
      payload.bannerDescriptor = String(
        formData.get("bannerDescriptor") || "",
      );
      payload.bannerCleanupToken = String(
        formData.get("bannerCleanupToken") || "",
      );
    }

    if (bannerState === "REMOVED") {
      payload.bannerUrl = null;
    }

    if (selectedProgram) {
      payload.expectedUpdatedAt = String(
        formData.get("expectedUpdatedAt") || "",
      );
    }

    await saveMutation.mutateAsync({
      payload,
      programId: selectedProgram?.id,
    });
  };

  const handleConfirmToggle = () => {
    if (!selectedProgram) return;
    toggleMutation.mutate({
      programId: selectedProgram.id,
      isActive: !selectedProgram.isActive,
      expectedUpdatedAt: selectedProgram.updatedAt,
    });
  };

  return {
    modalState,
    modalAddState,
    selectedProgram,
    isActionLoading: saveMutation.isPending || toggleMutation.isPending,
    mutationError: saveMutation.error || toggleMutation.error,
    handleAddProgram,
    handleAddToggleClick,
    handleConfirmToggle,
    handleEditToggleClick,
    handleToggleClick,
  };
}
