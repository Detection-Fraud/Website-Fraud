"use client";

import AppBar from "@/components/layout/Appbar";
import { Banner, useBanners } from "@/hooks/useBanners";
import { Card, useOverlayState } from "@heroui/react";
import { useEffect, useState } from "react";
import { PiCheckCircleFill, PiImageFill, PiXCircleFill } from "react-icons/pi";
import BannerFormModal, { BannerFormData } from "./BannerFormModal";
import BannerPreviewSimulator from "./BannerPreviewSimulator";
import BannerCardGrid from "./BannerCardGrid";
import ModalConfirmAction from "@/components/ui/ModalConfirmAction";
import PaginationFooter from "@/components/ui/PaginationFooter";

const BANNER_PAGE_SIZE = 100;

export default function BannersView() {
  const {
    useGetBanners,
    useGetAllBanners,
    useCreateBanner,
    useUpdateBanner,
    useDeleteBanner,
    useReorderBanners,
  } = useBanners();

  const [page, setPage] = useState(1);
  const { data: bannerPage, isLoading, isError, refetch } = useGetAllBanners(
    page,
    BANNER_PAGE_SIZE,
  );
  const { data: activeBanners = [] } = useGetBanners();
  const createMutation = useCreateBanner();
  const updateMutation = useUpdateBanner();
  const deleteMutation = useDeleteBanner();
  const reorderMutation = useReorderBanners();

  const formModalState = useOverlayState();
  const deleteModalState = useOverlayState();

  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);

  useEffect(() => {
    if (!bannerPage) return;
    if (bannerPage.totalPages === 0 && page > 1) setPage(1);
    else if (bannerPage.totalPages > 0 && page > bannerPage.totalPages) {
      setPage(bannerPage.totalPages);
    }
  }, [bannerPage, page]);

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
      expectedUpdatedAt: banner.updatedAt,
    });
  };

  const handleFormSubmit = async (data: BannerFormData) => {
    if (selectedBanner) {
      await updateMutation.mutateAsync({ id: selectedBanner.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleConfirmDelete = () => {
    if (!selectedBanner) return;
    deleteMutation.mutate({
      id: selectedBanner.id,
      expectedUpdatedAt: selectedBanner.updatedAt,
    }, {
      onSuccess: () => deleteModalState.close(),
    });
  };

  const handleReorder = (bannerId: string, direction: "up" | "down") => {
    const banner = bannerPage?.items.find((item) => item.id === bannerId);
    if (!banner) return;
    reorderMutation.mutate({
      id: banner.id,
      direction,
      expectedUpdatedAt: banner.updatedAt,
    });
  };

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  const bannerList = bannerPage?.items ?? [];
  const totalBanners = bannerPage?.total ?? 0;
  const activeCount = bannerPage?.activeCount ?? 0;
  const inactiveCount = totalBanners - activeCount;
  const reorderError = reorderMutation.error as {
    response?: { data?: { message?: unknown } };
  } | null;
  const reorderErrorMessage =
    typeof reorderError?.response?.data?.message === "string"
      ? reorderError.response.data.message
      : "Urutan banner gagal diperbarui. Silakan coba lagi.";

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
              {bannerPage ? totalBanners : "—"}
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
              {bannerPage ? activeCount : "—"}
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
              {bannerPage ? inactiveCount : "—"}
            </h4>
          </div>
        </Card>
      </div>

      {/* 1. Live Simulator Section */}
      <BannerPreviewSimulator banners={activeBanners} />

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
        ) : isError && !bannerPage ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 py-12 px-4 text-center bg-white rounded-xl border border-rose-200"
          >
            <p className="text-sm font-medium text-rose-700">
              Gagal memuat daftar banner. Silakan coba lagi.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <BannerCardGrid
            banners={bannerList}
            globalOffset={(page - 1) * BANNER_PAGE_SIZE}
            totalBanners={totalBanners}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleStatus={handleToggleStatus}
            onReorder={handleReorder}
            isUpdating={isMutating}
          />
        )}
        {reorderMutation.isError && (
          <p role="alert" className="text-sm font-medium text-rose-700">
            {reorderErrorMessage}
          </p>
        )}
        {!isLoading && bannerPage && bannerPage.totalPages > 1 && (
          <PaginationFooter
            page={bannerPage.page}
            totalPages={bannerPage.totalPages}
            totalItems={bannerPage.total}
            itemsPerPage={bannerPage.pageSize}
            itemLabel="banner"
            onPageChange={setPage}
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
