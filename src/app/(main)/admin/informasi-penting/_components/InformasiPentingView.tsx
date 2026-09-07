"use client";

import AppBar from "@/components/layout/Appbar";
import ModalConfirmAction from "@/components/ui/ModalConfirmAction";
import {
  type ImportantInformationError,
  getImportantInformationError,
  importantInformationKeys,
  useAdminImportantInformation,
  useCreateImportantInformation,
  useDeleteImportantInformation,
  useReorderImportantInformation,
  useSetImportantInformationStatus,
  useUpdateImportantInformation,
} from "@/hooks/useImportantInformation";
import type { ImportantInformationItem } from "@/types/important-information";
import { Alert, Button, Card, toast, useOverlayState } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  PiArrowClockwise,
  PiCheckCircleFill,
  PiImageFill,
  PiPlus,
  PiXCircleFill,
} from "react-icons/pi";
import InformasiPentingCardGrid from "./InformasiPentingCardGrid";
import InformasiPentingFormModal from "./InformasiPentingFormModal";

export default function InformasiPentingView() {
  const { data, isLoading, isError, error, refetch } =
    useAdminImportantInformation();
  const createMutation = useCreateImportantInformation();
  const updateMutation = useUpdateImportantInformation();
  const deleteMutation = useDeleteImportantInformation();
  const statusMutation = useSetImportantInformationStatus();
  const reorderMutation = useReorderImportantInformation();

  const formModalState = useOverlayState();
  const deleteModalState = useOverlayState();

  const [selectedItem, setSelectedItem] =
    useState<ImportantInformationItem | null>(null);
  const [selectedDeleteItem, setSelectedDeleteItem] =
    useState<ImportantInformationItem | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const items = data?.items || [];
  const activeCount = items.filter(
    (item: ImportantInformationItem) => item.isActive,
  ).length;
  const inactiveCount = items.length - activeCount;

  const queryClient = useQueryClient();
  const [candidateIds, setCandidateIds] = useState<string[] | null>(null);
  const [orderConflict, setOrderConflict] =
    useState<ImportantInformationError | null>(null);
  const reorderFocusRef = useRef<{
    id: string;
    direction: "up" | "down";
  } | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const revision = data?.revision;
  const previousRevisionRef = useRef(revision);

  const candidateItems =
    candidateIds?.length === items.length
      ? candidateIds
          .map((id) => items.find((item) => item.id === id))
          .filter((item): item is ImportantInformationItem => item !== undefined)
      : [];
  const orderedItems =
    candidateItems.length === items.length ? candidateItems : items;

  const restoreReorderFocus = () => {
    const target = reorderFocusRef.current;
    if (!target) return;
    requestAnimationFrame(() => {
      const selector = (direction: "up" | "down") =>
        `[data-reorder-id="${target.id}"][data-reorder-direction="${direction}"]:not(:disabled):not([aria-disabled="true"])`;
      const replacement =
        document.querySelector<HTMLButtonElement>(selector(target.direction)) ??
        document.querySelector<HTMLButtonElement>(
          selector(target.direction === "up" ? "down" : "up"),
        ) ??
        document.querySelector<HTMLButtonElement>(
          '[data-reorder-id]:not(:disabled):not([aria-disabled="true"])',
        );

      if (replacement) replacement.focus();
      else listHeadingRef.current?.focus();
      reorderFocusRef.current = null;
    });
  };

  useEffect(() => {
    if (revision !== previousRevisionRef.current) {
      previousRevisionRef.current = revision;
      setCandidateIds(null);
    }
  }, [revision]);

  const handleAddClick = () => {
    setSelectedItem(null);
    setSubmitError(null);
    formModalState.open();
  };

  const handleEditClick = (item: ImportantInformationItem) => {
    setSelectedItem(item);
    setSubmitError(null);
    formModalState.open();
  };

  const handleDeleteClick = (item: ImportantInformationItem) => {
    setSelectedDeleteItem(item);
    deleteModalState.open();
  };

  const handleToggleStatus = async (item: ImportantInformationItem) => {
    setPendingStatusId(item.id);
    try {
      await statusMutation.mutateAsync({
        id: item.id,
        isActive: !item.isActive,
      });
      toast.success(
        `Informasi posisi ${item.order + 1} berhasil ${
          !item.isActive ? "diaktifkan" : "dinonaktifkan"
        }`,
      );
    } catch (err) {
      toast.danger(getImportantInformationError(err).message);
    } finally {
      setPendingStatusId(undefined);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedDeleteItem) return;
    try {
      await deleteMutation.mutateAsync(selectedDeleteItem.id);
      deleteModalState.close();
      toast.success(
        `Informasi posisi ${selectedDeleteItem.order + 1} berhasil dihapus`,
      );
      setSelectedDeleteItem(null);
    } catch (err) {
      toast.danger(getImportantInformationError(err).message);
    }
  };

  const handleReorder = async (id: string, direction: "up" | "down") => {
    if (!data || reorderMutation.isPending) return;
    const ids = orderedItems.map((item) => item.id);
    const currentIndex = ids.indexOf(id);
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ids.length)
      return;

    const nextIds = [...ids];
    [nextIds[currentIndex], nextIds[targetIndex]] = [
      nextIds[targetIndex],
      nextIds[currentIndex],
    ];

    reorderFocusRef.current = { id, direction };
    setCandidateIds(nextIds);

    try {
      await reorderMutation.mutateAsync({
        ids: nextIds,
        revision: data.revision,
      });
      setCandidateIds(null);
      setOrderConflict(null);
      toast.success("Urutan informasi berhasil diperbarui");
      restoreReorderFocus();
    } catch (error) {
      const parsed = getImportantInformationError(error);
      setCandidateIds(null);
      if (parsed.code === "ORDER_CONFLICT") {
        setOrderConflict(parsed);
        await queryClient.invalidateQueries({
          queryKey: importantInformationKeys.admin,
        });
      } else {
        toast.danger(parsed.message);
        restoreReorderFocus();
      }
    }
  };

  const handleModalSubmit = async (input: { altText: string; file?: File }) => {
    setSubmitError(null);
    try {
      if (selectedItem) {
        await updateMutation.mutateAsync({
          id: selectedItem.id,
          altText: input.altText,
          file: input.file,
        });
        toast.success("Informasi Penting berhasil diperbarui");
      } else {
        await createMutation.mutateAsync({
          altText: input.altText,
          file: input.file as File,
        });
        toast.success("Informasi Penting berhasil ditambahkan");
      }
      formModalState.close();
    } catch (err) {
      const parsed = getImportantInformationError(err);
      setSubmitError(parsed.message);
      throw err;
    }
  };

  const isFormPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 mb-12">
      <AppBar
        title="Informasi Penting"
        description="Kelola gambar informasi yang ditampilkan untuk seluruh PIC."
        textAddButton="Tambah Informasi"
        onAdd={handleAddClick}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 border border-slate-200/80 shadow-sm flex flex-row items-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <PiImageFill className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total</p>
            <h4 className="text-xl font-extrabold text-slate-800">
              {isLoading ? "-" : items.length}
            </h4>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200/80 shadow-sm flex flex-row items-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <PiCheckCircleFill className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Aktif</p>
            <h4 className="text-xl font-extrabold text-slate-800">
              {isLoading ? "-" : activeCount}
            </h4>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200/80 shadow-sm flex flex-row items-center gap-4 bg-white">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <PiXCircleFill className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Nonaktif</p>
            <h4 className="text-xl font-extrabold text-slate-800">
              {isLoading ? "-" : inactiveCount}
            </h4>
          </div>
        </Card>
      </div>

      {/* Content Section */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            {orderConflict && (
              <Alert status="warning" className="mb-4">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Urutan tidak diterapkan</Alert.Title>
                  <Alert.Description>
                    Urutan tidak diterapkan karena daftar Informasi Penting
                    telah berubah. Muat ulang daftar sebelum mengatur urutan
                    kembali.
                  </Alert.Description>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={async () => {
                        const result = await refetch();
                        if (result.error) {
                          toast.danger(
                            getImportantInformationError(result.error).message,
                          );
                        } else {
                          setOrderConflict(null);
                          restoreReorderFocus();
                        }
                      }}
                    >
                      Muat ulang daftar
                    </Button>
                  </div>
                </Alert.Content>
              </Alert>
            )}

            <h3
              ref={listHeadingRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus]"
            >
              Daftar Informasi
            </h3>
            <p className="text-xs text-slate-500">
              Urutan menentukan tampilan pada carousel PIC. Informasi nonaktif
              tidak akan ditampilkan.
            </p>
          </div>
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                className="overflow-hidden border border-slate-200 bg-white p-0 animate-pulse"
              >
                <div className="aspect-[2/1] w-full bg-slate-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-1/3 bg-slate-200 rounded" />
                  <div className="h-8 bg-slate-200 rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-4">
            <div
              role="alert"
              className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm font-medium text-red-600">
                {getImportantInformationError(error).message}
              </p>
              <Button
                variant="outline"
                size="sm"
                onPress={() => refetch()}
                className="flex items-center gap-2"
              >
                <PiArrowClockwise className="w-4 h-4" />
                Coba lagi
              </Button>
            </div>
            {items.length > 0 && (
              <InformasiPentingCardGrid
                items={orderedItems}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                onToggleStatus={handleToggleStatus}
                onReorder={handleReorder}
                pendingStatusId={pendingStatusId}
                pendingDeleteId={
                  deleteMutation.isPending
                    ? deleteMutation.variables
                    : undefined
                }
                isReorderPending={reorderMutation.isPending}
              />
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <PiImageFill className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700">
                Belum ada Informasi Penting
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Tambahkan gambar informasi pertama yang akan ditampilkan untuk
                PIC.
              </p>
            </div>
            <Button
              size="sm"
              onPress={handleAddClick}
              className="flex items-center gap-2 mt-2"
            >
              <PiPlus className="w-4 h-4" />
              Tambah Informasi
            </Button>
          </div>
        ) : (
          <InformasiPentingCardGrid
            items={orderedItems}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleStatus={handleToggleStatus}
            onReorder={handleReorder}
            pendingStatusId={pendingStatusId}
            pendingDeleteId={
              deleteMutation.isPending ? deleteMutation.variables : undefined
            }
            isReorderPending={reorderMutation.isPending}
          />
        )}
      </div>

      {/* Form Modal */}
      <InformasiPentingFormModal
        isOpen={formModalState.isOpen}
        item={selectedItem}
        onClose={formModalState.close}
        onSubmit={handleModalSubmit}
        isPending={isFormPending}
        submitError={submitError}
      />

      {/* Delete Confirmation Modal */}
      <ModalConfirmAction
        isOpen={deleteModalState.isOpen}
        onClose={deleteModalState.close}
        onConfirm={handleConfirmDelete}
        title="Hapus Informasi Penting"
        description={
          selectedDeleteItem ? (
            <>
              Apakah Anda yakin ingin menghapus informasi pada{" "}
              <strong>Posisi {selectedDeleteItem.order + 1}</strong> (
              <em>{selectedDeleteItem.altText}</em>)? Tindakan ini tidak dapat
              dibatalkan.
            </>
          ) : null
        }
        confirmText="Hapus Informasi"
        confirmColor="danger"
        isLoading={
          deleteMutation.isPending &&
          deleteMutation.variables === selectedDeleteItem?.id
        }
      />
    </div>
  );
}
