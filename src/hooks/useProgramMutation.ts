import { api } from "@/lib/api";
import { ProgramBudaya } from "@generated/prisma";
import { useOverlayState } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface ProgramPayload {
  name: string;
  frequency: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
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

  const handleToggleClick = (program: ProgramBudaya) => {
    setSelectedProgram(program);
    modalState.open();
  };

  const handleEditToggleClick = (program: ProgramBudaya) => {
    setSelectedProgram(program);
    modalAddState.open();
  };

  const handleAddProgram = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: ProgramPayload = {
      name: formData.get("name") as string,
      frequency: Number(formData.get("frequency")),
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      isActive: true,
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
