"use client";

import AppBar from "@/components/layout/Appbar";
import SelectUnitType from "./SelectUnitType";
import { useState } from "react";
import { UserWithUnit } from "@/types/user.types";
import { useOverlayState } from "@heroui/react";
import { useUnitList } from "@/hooks/useUnitList";
import { useManagementUsers } from "@/hooks/useManagementUsers";
import UnitListPanel from "./UnitListPanel";
import UserTablePanel from "./UserTablePanel";
import ModalAddPic from "./ModalAddPIC";
import { useTogglePicStatus } from "@/hooks/useTogglePicStatus";
import ModalConfirmAction from "./ModalConfirmAction";
import { useDeletePic } from "@/hooks/useDeletePic";

export default function ManagementUserView() {
  const [selectedUnitType, setSelectedUnitType] = useState<string>("KANWIL");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("ALL");

  const [unitSearch, setUnitSearch] = useState<string>("");

  const [userSearch, setUserSearch] = useState<string>("");

  const [userPage, setUserPage] = useState<number>(1);

  const [editingUser, setEditingUser] = useState<UserWithUnit | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: "TOGGLE_STATUS" | "DELETE" | null;
    user: UserWithUnit | null;
    newStatus?: boolean;
  }>({
    isOpen: false,
    action: null,
    user: null,
  });
  const stateModal = useOverlayState();

  const { units, isLoading: isLoadingUnits } = useUnitList(selectedUnitType);
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? null;

  const {
    users,
    pagination,
    isLoading: isLoadingUsers,
    refetch,
  } = useManagementUsers({
    unitId: selectedUnit?.id ?? "",
    search: userSearch,
    page: userPage,
  });

  const { toggleStatus, isUpdating } = useTogglePicStatus({
    onSuccess: () => {
      refetch();
    },
  });
  const handleDeleteUser = (user: UserWithUnit) => {
    // Buka Modal Konfirmasi
    setConfirmModal({
      isOpen: true,
      action: "DELETE",
      user,
    });
  };

  const { deleteUser, isDeleting } = useDeletePic({
    onSuccess: () => {
      refetch();
    },
  });
  const handleToggleStatus = async (user: UserWithUnit, newStatus: boolean) => {
    setConfirmModal({
      isOpen: true,
      action: "TOGGLE_STATUS",
      user,
      newStatus,
    });
  };

  const handleUnitTypeChange = (type: string) => {
    setSelectedUnitType(type);
    setSelectedUnitId("ALL"); // reset pilihan unit
    setUnitSearch("");
    setUserSearch("");
    setUserPage(1);
  };

  const handleSelectUnit = (unitId: string) => {
    setSelectedUnitId(unitId);
    setUserSearch("");
    setUserPage(1);
  };

  const handleUserSearchChange = (val: string) => {
    setUserSearch(val);
    setUserPage(1); // reset ke halaman 1 setiap search baru
  };

  const handleAddUser = () => {
    setEditingUser(null); // mode tambah baru
    stateModal.open();
  };

  const handleEditUser = (user: UserWithUnit) => {
    setEditingUser(user); // mode edit
    stateModal.open();
  };

  const handleModalSuccess = () => {
    stateModal.close();
    setEditingUser(null);
    refetch(); // refresh tabel
  };

  const executeConfirmAction = async () => {
    if (!confirmModal.user) return;

    if (confirmModal.action === "TOGGLE_STATUS") {
      await toggleStatus({
        userId: confirmModal.user.id,
        isActive: confirmModal.newStatus!,
      });
    } else if (confirmModal.action === "DELETE") {
      await deleteUser(confirmModal.user.id);
      setConfirmModal({
        isOpen: false,
        action: null,
        user: null,
      });
    }

    // Tutup modal & reset state
    setConfirmModal({
      isOpen: false,
      action: null,
      user: null,
    });
  };
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <AppBar
          title="User Management"
          description="Kelola PIC unit kerja BULOG — Kanwil, Kancab, dan Divisi"
          showAddButton={false}
        />

        <SelectUnitType
          value={selectedUnitType}
          onChange={handleUnitTypeChange}
          className="min-w-72"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,32%)_1fr] gap-4">
        <UnitListPanel
          units={units}
          selectedUnitId={selectedUnitId}
          onSelectUnit={handleSelectUnit}
          unitType={selectedUnitType}
          searchQuery={unitSearch}
          onSearchChange={setUnitSearch}
          onAddUser={handleAddUser}
          isLoading={isLoadingUnits}
        />

        <UserTablePanel
          unit={
            selectedUnit
              ? {
                  id: selectedUnit.id,
                  name: selectedUnit.name,
                  type: selectedUnitType,
                }
              : null
          }
          unitType={selectedUnitType}
          users={users}
          pagination={pagination}
          isLoading={isLoadingUsers}
          searchQuery={userSearch}
          onSearchChange={handleUserSearchChange}
          onPageChange={setUserPage}
          onToggleStatus={handleToggleStatus}
          isUpdatingStatus={isUpdating}
          onDelete={handleDeleteUser}
        />
      </div>

      <ModalAddPic
        isOpen={stateModal.isOpen}
        onClose={() => stateModal.close()}
        selectedUnit={selectedUnit}
        onSuccess={handleModalSuccess}
      />

      <ModalConfirmAction
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({ isOpen: false, action: null, user: null })
        }
        onConfirm={executeConfirmAction}
        isLoading={isUpdating === confirmModal.user?.id}
        title={
          confirmModal.action === "TOGGLE_STATUS"
            ? confirmModal.newStatus
              ? "Aktifkan PIC"
              : "Nonaktifkan PIC"
            : "Hapus PIC"
        }
        description={
          confirmModal.action === "TOGGLE_STATUS" ? (
            <span>
              Apakah Anda yakin ingin{" "}
              <strong>
                {confirmModal.newStatus ? "mengaktifkan" : "menonaktifkan"}
              </strong>{" "}
              PIC <strong>{confirmModal.user?.name}</strong>?
            </span>
          ) : (
            <span>
              Apakah Anda yakin ingin menghapus PIC{" "}
              <strong>{confirmModal.user?.name}</strong> secara permanen? Aksi
              ini tidak dapat dibatalkan.
            </span>
          )
        }
        confirmText={
          confirmModal.action === "TOGGLE_STATUS"
            ? confirmModal.newStatus
              ? "Ya, Aktifkan"
              : "Ya, Nonaktifkan"
            : "Ya, Hapus"
        }
      />
    </div>
  );
}
