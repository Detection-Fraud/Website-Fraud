import { api } from "@/lib/api";
import { ProgramBudaya } from "@generated/prisma";
import { toast, useOverlayState } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  bannerUrl?: string | null;
}

export function useProgramMutation() {
  const queryClient = useQueryClient();
  const modalState = useOverlayState();
  const modalAddState = useOverlayState();
  const [selectedProgram, setSelectedProgram] = useState<ProgramBudaya | null>(
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
    onSuccess: async () => {
      await invalidateProgramQueries();
      modalAddState.close();
    },
    onError: (error: any) => {
      toast.danger("Gagal menyimpan", {
        description:
          error.response?.data?.message ||
          error.message ||
          "Gagal menyimpan program",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      programId,
      isActive,
    }: {
      programId: string;
      isActive: boolean;
    }) => api.patch(`/programs/${programId}`, { isActive }),
    onSuccess: async () => {
      await invalidateProgramQueries();
      modalState.close();
    },
  });

  const handleAddToggleClick = () => {
    setSelectedProgram(null);
    modalAddState.open();
  };

  const handleEditToggleClick = (program: ProgramBudaya) => {
    setSelectedProgram(program);
    modalAddState.open();
  };

  const handleToggleClick = (program: ProgramBudaya) => {
    setSelectedProgram(program);
    modalState.open();
  };

  const handleAddProgram = (formData: FormData) => {
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
      bannerUrl: String(formData.get("bannerUrl") || "") || null,
    };

    saveMutation.mutate({ payload, programId: selectedProgram?.id });
  };

  const handleConfirmToggle = () => {
    if (!selectedProgram) return;
    toggleMutation.mutate({
      programId: selectedProgram.id,
      isActive: !selectedProgram.isActive,
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
