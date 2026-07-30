"use client";

import ModalConfirmAction from "@/components/ui/ModalConfirmAction";
import { CategoryWithStats, useCategoryList } from "@/hooks/useCategoryList";
import { useCategoryMutation } from "@/hooks/useCategoryMutation";
import { Button, Card, Skeleton } from "@heroui/react";
import { useState } from "react";
import { FiFolderPlus, FiPlus } from "react-icons/fi";
import CategoryCardItem from "./_components/CategoryCardItem";
import ModalFormCategory from "./_components/ModalFormCategory";

export default function AdminCategoriesPage() {
  const { categories, isLoading } = useCategoryList();
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Halaman */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
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
          className="bg-blue-600 text-white font-semibold flex items-center gap-2 shadow-xs"
        >
          <FiPlus className="size-4" /> Tambah Kategori
        </Button>
      </header>

      {/* Main Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        /* Empty State */
        <Card className="border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center rounded-2xl">
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
              variant="primary"
              onPress={handleOpenCreate}
              className="bg-blue-600 text-white font-semibold mt-2"
            >
              <FiPlus className="size-4 mr-1" /> Buat Kategori Pertama
            </Button>
          </Card.Content>
        </Card>
      ) : (
        /* Category Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat: CategoryWithStats) => (
            <CategoryCardItem
              key={cat.id}
              category={cat}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteClick}
              isDeleting={isDeleting && deleteTarget?.id === cat.id}
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
