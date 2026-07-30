import { api } from "@/lib/api";
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/schemas/program.schema";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCategoryMutation() {
  const queryClient = useQueryClient();

  const invalidateCategories = () => {
    queryClient.invalidateQueries({
      queryKey: ["categories"],
    });
  };

  const createCategoryMutation = useMutation({
    mutationFn: (data: CreateCategoryInput) =>
      api.post("/programs/categories", data).then((res) => res.data),
    onSuccess: () => {
      invalidateCategories();
      toast.success("Kategori berhasil ditambahkan");
    },
    onError: (err: any) => {
      toast.danger(
        "Gagal menambahkan kategori: " +
          (err.response?.data?.message || err.message),
      );
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) =>
      api.put(`/programs/categories/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      invalidateCategories();
      toast.success("Kategori berhasil diperbarui");
    },
    onError: (err: any) => {
      toast.danger(
        "Gagal memperbarui kategori: " +
          (err.response?.data?.message || err.message),
      );
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/programs/categories/${id}`).then((res) => res.data),
    onSuccess: () => {
      invalidateCategories();
      toast.success("Kategori berhasil dihapus");
    },
    onError: (err: any) => {
      toast.danger(
        "Gagal menghapus kategori: " +
          (err.response?.data?.message || err.message),
      );
    },
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
