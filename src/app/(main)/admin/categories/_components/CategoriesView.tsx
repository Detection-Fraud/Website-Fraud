"use client";

import ModalConfirmAction from "@/components/ui/ModalConfirmAction";
import { CategoryWithStats, useCategoryList } from "@/hooks/useCategoryList";
import { useCategoryMutation } from "@/hooks/useCategoryMutation";
import { Alert, Button, Card, Skeleton } from "@heroui/react";
import { useState } from "react";
import { FiFolderPlus, FiPlus } from "react-icons/fi";
import CategoryCardItem from "./CategoryCardItem";
import ModalFormCategory from "./ModalFormCategory";

export default function CategoriesView() {
  const { categories, isLoading, error, refetch } = useCategoryList();
  const { deleteCategory, isDeleting } = useCategoryMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryWithStats | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithStats | null>(
    null,
  );

  const handleOpenCreate = () => {
    setSelectedCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: CategoryWithStats) => {
    setSelectedCategory(cat);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    const found = categories.find((c: CategoryWithStats) => c.id === id);
    if (found) setDeleteTarget(found);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      // Error handled by mutation toast
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="inline-block w-1.5 h-6 rounded-full bg-blue-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Kategori Program Budaya
            </h1>
          </div>
          <p className="text-sm text-slate-500 ml-3.5">
            Kelola template master kategori, warna identitas, dan satuan target
            program.
          </p>
        </div>

        <Button
          variant="primary"
          onPress={handleOpenCreate}
          className="flex min-h-11 w-full items-center justify-center gap-2 bg-blue-600 font-semibold text-white shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 md:w-auto"
        >
          <FiPlus className="size-4" /> Tambah Kategori
        </Button>
      </header>

      {/* Main Content Grid */}
      {isLoading ? (
        <div
          aria-busy="true"
          aria-label="Memuat kategori"
          aria-live="polite"
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
          role="status"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="flex h-full min-h-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="flex flex-1 flex-col gap-5 p-5">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                    <Skeleton className="h-4 w-4/5 rounded-md" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  {Array.from({ length: 5 }, (_, metricIndex) => (
                    <div key={metricIndex} className="space-y-1">
                      <Skeleton className="h-3 w-3/4 rounded-md" />
                      <Skeleton className="h-5 w-10 rounded-md" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-2/5 rounded-md" />
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:justify-end">
                <Skeleton className="h-11 w-full rounded-md sm:w-20" />
                <Skeleton className="h-11 w-full rounded-md sm:w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div aria-live="assertive">
          <Alert
            className="flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            role="alert"
            status="danger"
          >
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Gagal memuat kategori</Alert.Title>
              <Alert.Description>
                {error || "Kategori tidak dapat dimuat saat ini."}
              </Alert.Description>
            </Alert.Content>
            <Button
              aria-label="Coba lagi memuat kategori"
              className="min-h-11 w-full shrink-0 focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 sm:w-auto"
              onPress={() => void refetch()}
              variant="danger"
            >
              Coba lagi
            </Button>
          </Alert>
        </div>
      ) : categories.length === 0 ? (
        /* Empty State */
        <div aria-atomic="true" aria-live="polite" role="status">
          <Card className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center sm:p-12">
            <Card.Content className="flex flex-col items-center justify-center space-y-3">
              <div className="size-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <FiFolderPlus className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Belum Ada Kategori Program
              </h3>
              <p className="text-sm text-slate-500 max-w-md">
                Kategori digunakan sebagai template master untuk mengelompokkan
                program budaya per Triwulan (TW).
              </p>
              <Button
                className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto"
                onPress={handleOpenCreate}
                variant="primary"
              >
                <FiPlus className="size-4 mr-1" /> Buat Kategori Pertama
              </Button>
            </Card.Content>
          </Card>
        </div>
      ) : (
        /* Category Grid */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category: CategoryWithStats) => (
            <CategoryCardItem
              key={category.id}
              category={category}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteClick}
              isDeleting={isDeleting && deleteTarget?.id === category.id}
            />
          ))}
        </div>
      )}

      {/* Modal Form Dialog */}
      <ModalFormCategory
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedCategory}
      />

      {/* Modal Confirm Delete */}
      <ModalConfirmAction
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Kategori Program"
        description={
          <p>
            Apakah Anda yakin ingin menghapus kategori{" "}
            <strong className="text-slate-900">{deleteTarget?.name}</strong>?
            Tindakan ini tidak dapat dibatalkan.
          </p>
        }
        confirmText="Ya, Hapus"
        confirmColor="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
