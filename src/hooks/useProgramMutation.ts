import { api } from "@/lib/api";
import { ProgramBudaya } from "@generated/prisma";
import { toast, useOverlayState } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface ProgramPayload {
  name: string;
  frequency: number;
  tw?: number | null;
  startDate: string;
  endDate: string;
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

  const saveMutation = useMutation({
    mutationFn: async ({
      payload,
      programId,
    }: {
      payload: ProgramPayload;
      programId?: string;
    }) => {
      if (programId) {
        return api.put(`/programs/${programId}`, payload);
      }
      return api.post("/programs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      modalAddState.close();
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message ||
        error?.message ||
        "Gagal menyimpan program";
      toast.danger("Gagal Menyimpan", { description: message });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      programId,
      isActive,
    }: {
      programId: string;
      isActive: boolean;
    }) => {
      return api.patch(`/programs/${programId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
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

  const handleAddProgram = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const payload: ProgramPayload = {
      name: formData.get("name") as string,
      frequency: Number(formData.get("frequency")),
      tw: Number(formData.get("tw")) || null,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      isActive: true,
      categoryId: (formData.get("categoryId") as string) || null,
      description: (formData.get("description") as string) || null,
      bannerUrl: (formData.get("bannerUrl") as string) || null,
    };

    saveMutation.mutate({
      payload,
      programId: selectedProgram?.id,
    });
  };

  const handleConfirmToggle = async () => {
    if (!selectedProgram) return;
    toggleMutation.mutate({
      programId: selectedProgram.id,
      isActive: !selectedProgram.isActive,
    });
  };

  return {
    // Modal & Actions
    modalState,
    selectedProgram,
    isActionLoading: saveMutation.isPending || toggleMutation.isPending,
    handleToggleClick,
    handleConfirmToggle,

    // Modal add & update
    modalAddState,
    handleAddToggleClick,
    handleAddProgram,
    handleEditToggleClick,

    // Error dari mutations
    mutationError: saveMutation.error || toggleMutation.error,
  };
}
