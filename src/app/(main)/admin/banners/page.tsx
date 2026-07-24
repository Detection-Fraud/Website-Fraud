"use client";

import AppBar from "@/components/layout/Appbar";
import { Banner, useBanners } from "@/hooks/useBanners";
import { Card, useOverlayState } from "@heroui/react";
import { useState } from "react";
import { PiCheckCircleFill, PiImageFill, PiXCircleFill } from "react-icons/pi";
import ModalConfirmAction from "../management/_components/ModalConfirmAction";
import BannerCardGrid from "./_components/BannerCardGrid";
import BannerFormModal, { BannerFormData } from "./_components/BannerFormModal";
import BannerPreviewSimulator from "./_components/BannerPreviewSimulator";

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

  const bannerList = (banners as Banner[]) || [];
  const activeCount = bannerList.filter((b: Banner) => b.isActive).length;
  const inactiveCount = bannerList.length - activeCount;

  return (
    <div className="space-y-6 mb-12">
      <AppBar
        title="Manajemen Banner Login"
        description="Kelola data PIC terbaik yang tampil di carousel halaman login secara visual & real-time"
        textAddButton="Tambah Banner"
        onAdd={handleAddClick}
      />

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 border border-slate-200/80 shadow-sm flex flex-row items-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <PiImageFill className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Banner</p>
            <h4 className="text-xl font-extrabold text-slate-800">
              {bannerList.length}
            </h4>
          </div>
        </Card>

        <Card className="p-4 border border-slate-200/80 shadow-sm flex flex-row items-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <PiCheckCircleFill className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">
              Banner Aktif (Tayang)
            </p>
            <h4 className="text-xl font-extrabold text-slate-800">
              {activeCount}
            </h4>
          </div>
        </Card>

        <Card className="p-4 border border-slate-200/80 shadow-sm flex flex-row items-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <PiXCircleFill className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Non-Aktif</p>
            <h4 className="text-xl font-extrabold text-slate-800">
              {inactiveCount}
            </h4>
          </div>
        </Card>
      </div>

      {/* 1. Live Simulator Section */}
      <BannerPreviewSimulator banners={bannerList} />

      {/* 2. Visual Card Grid Section Header */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Daftar Banner</h3>
            <p className="text-xs text-slate-500">
              Atur urutan dan aktifkan banner yang ingin ditampilkan pada
              carousel login
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20 bg-white rounded-xl border border-slate-200">
            <p className="text-slate-400 text-sm font-medium">
              Memuat data banner...
            </p>
          </div>
        ) : (
          <BannerCardGrid
            banners={bannerList}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleStatus={handleToggleStatus}
            onReorder={handleReorder}
            isUpdating={isMutating}
          />
        )}
      </div>

      {/* Form Modal */}
      <BannerFormModal
        isOpen={formModalState.isOpen}
        onClose={formModalState.close}
        onSubmit={handleFormSubmit}
        isLoading={isMutating}
        banner={selectedBanner}
      />

      {/* Delete Confirmation Modal */}
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
