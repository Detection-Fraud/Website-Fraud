"use client";

import AppBar from "@/components/layout/Appbar";
import { Banner, useBanners } from "@/hooks/useBanners";
import { useOverlayState } from "@heroui/react";
import { useState } from "react";
import ModalConfirmAction from "../management/_components/ModalConfirmAction";
import BannerFormModal, { BannerFormData } from "./_components/BannerFormModal";
import BannerList from "./_components/BannerList";

export default function BannersPage() {
  const {
    useGetAllBanners,
    useCreateBanner,
    useUpdateBanner,
    useDeleteBanner,
    useReorderBanners,
  } = useBanners();

  const { data: banners, isLoading } = useGetAllBanners();
  const createMutation = useCreateBanner();
  const updateMutation = useUpdateBanner();
  const deleteMutation = useDeleteBanner();
  const reorderMutation = useReorderBanners();

  const formModalState = useOverlayState();
  const deleteModalState = useOverlayState();

  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);

  const handleAddClick = () => {
    setSelectedBanner(null);
    formModalState.open();
  };

  const handleEditClick = (banner: Banner) => {
    setSelectedBanner(banner);
    formModalState.open();
  };

  const handleDeleteClick = (banner: Banner) => {
    setSelectedBanner(banner);
    deleteModalState.open();
  };

  const handleToggleStatus = (banner: Banner) => {
    updateMutation.mutate({
      id: banner.id,
      isActive: !banner.isActive,
    });
  };

  const handleFormSubmit = (data: BannerFormData) => {
    if (selectedBanner) {
      updateMutation.mutate(
        { id: selectedBanner.id, ...data },
        { onSuccess: () => formModalState.close() },
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => formModalState.close(),
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!selectedBanner) return;
    deleteMutation.mutate(selectedBanner.id, {
      onSuccess: () => deleteModalState.close(),
    });
  };

  const handleReorder = (bannerId: string, direction: "up" | "down") => {
    if (!banners) return;

    const currentIndex = banners.findIndex((b: Banner) => b.id === bannerId);
    if (currentIndex === -1) return;

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const reordered = [...banners];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];

    const orderIds = reordered.map((b) => b.id);
    reorderMutation.mutate(orderIds);
  };

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  return (
    <div className="space-y-4 mb-10">
      <AppBar
        title="Manajemen Banner Login"
        description="Kelola data PIC terbaik yang tampil di carousel halaman login"
        textAddButton="Tambah Banner"
        onAdd={handleAddClick}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <p className="text-slate-400">Memuat data banner...</p>
        </div>
      ) : (
        <BannerList
          banners={banners || []}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onToggleStatus={handleToggleStatus}
          onReorder={handleReorder}
          isUpdating={isMutating}
        />
      )}

      <BannerFormModal
        isOpen={formModalState.isOpen}
        onClose={formModalState.close}
        onSubmit={handleFormSubmit}
        isLoading={isMutating}
        banner={selectedBanner}
      />

      <ModalConfirmAction
        isOpen={deleteModalState.isOpen}
        onClose={deleteModalState.close}
        onConfirm={handleConfirmDelete}
        title="Hapus Banner"
        description={
          <>
            Apakah Anda yakin ingin menghapus banner{" "}
            <strong>{selectedBanner?.name}</strong>? Tindakan ini tidak dapat
            dibatalkan.
          </>
        }
        confirmText="Hapus Banner"
        confirmColor="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
