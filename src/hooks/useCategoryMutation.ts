import { api } from "@/lib/api";
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/schemas/program.schema";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

export function useCategoryMutation() {
  const queryClient = useQueryClient();

  const invalidateCategories = () => {
    for (const queryKey of [
      ["category"],
      ["categories"],
      ["program"],
      ["programs"],
      ["program-categories"],
      ["program-list"],
      ["reports"],
      ["report-filter-options"],
      ["compliance-options"],
      ["import-categories"],
      ["participation-reports"],
    ])
      queryClient.invalidateQueries({ queryKey });
  };

  const createCategoryMutation = useMutation({
    mutationFn: (data: CreateCategoryInput) =>
      api.post("/programs/categories", data).then((res) => res.data),
    onSuccess: () => {
      invalidateCategories();
      toast.success("Kategori berhasil ditambahkan");
    },
    onError: (error: unknown) =>
      toast.danger("Gagal menambahkan kategori: " + getErrorMessage(error)),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) =>
      api.put(`/programs/categories/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      invalidateCategories();
      toast.success("Kategori berhasil diperbarui");
    },
    onError: (error: unknown) =>
      toast.danger("Gagal memperbarui kategori: " + getErrorMessage(error)),
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/programs/categories/${id}`).then((res) => res.data),
    onSuccess: () => {
      invalidateCategories();
      toast.success("Kategori berhasil dihapus");
    },
    onError: (error: unknown) =>
      toast.danger("Gagal menghapus kategori: " + getErrorMessage(error)),
  });

  return {
    createCategory: createCategoryMutation.mutateAsync,
    updateCategory: updateCategoryMutation.mutateAsync,
    deleteCategory: deleteCategoryMutation.mutateAsync,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending,
    isDeleting: deleteCategoryMutation.isPending,
  };
}
