"use client";

import AppBar from "@/components/layout/Appbar";
import { useManagementUsers } from "@/hooks/useManagementUsers";
import { usePicMutation } from "@/hooks/usePicMutation";
import { useUnitList } from "@/hooks/useUnitList";
import { UserWithUnit } from "@/types/user.types";
import { useOverlayState } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import {
  getEmployeeManagementDeepLinkWarning,
  parseEmployeeManagementDeepLink,
} from "@/lib/employee-management-actions";
import ModalAddPic from "./ModalAddPIC";
import ModalConfirmAction from "./ModalConfirmAction";
import SelectUnitType from "./SelectUnitType";
import UnitListPanel from "./UnitListPanel";
import UserTablePanel from "./UserTablePanel";

interface ManagementUserViewProps {
  deepLinkParams?: {
    unitId?: string;
    nip?: string;
    unitType?: string;
  };
}

export default function ManagementUserView({
  deepLinkParams = {},
}: ManagementUserViewProps) {
  const deepLinkSearchParams = new URLSearchParams();
  if (deepLinkParams.unitId) deepLinkSearchParams.set("unitId", deepLinkParams.unitId);
  if (deepLinkParams.nip) deepLinkSearchParams.set("nip", deepLinkParams.nip);
  if (deepLinkParams.unitType) deepLinkSearchParams.set("unitType", deepLinkParams.unitType);
  const deepLink = parseEmployeeManagementDeepLink(deepLinkSearchParams);
  const deepLinkWarning = getEmployeeManagementDeepLinkWarning(deepLinkSearchParams);
  const appliedDeepLink = useRef<string | null>(null);
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
  const [deepLinkMessage, setDeepLinkMessage] = useState<string | null>(
    deepLinkWarning,
  );
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const stateModal = useOverlayState();

  const { units, isLoading: isLoadingUnits } = useUnitList(selectedUnitType);
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? null;

  useEffect(() => {
    if (deepLinkWarning) {
      setDeepLinkMessage(deepLinkWarning);
      return;
    }

    if (!deepLink) {
      setDeepLinkMessage(null);
      return;
    }

    if (!deepLink || appliedDeepLink.current === `${deepLink.unitId}:${deepLink.nip}`) {
      return;
    }

    if (deepLink.unitType && deepLink.unitType !== selectedUnitType) {
      setSelectedUnitType(deepLink.unitType);
      setSelectedUnitId("ALL");
      setUserSearch("");
      setUserPage(1);
      return;
    }

    const verifiedUnit = units.find((unit) => unit.id === deepLink.unitId);
    if (!verifiedUnit) {
      if (!isLoadingUnits) {
        setDeepLinkMessage(
          "Unit pada deep-link tidak ditemukan untuk tipe unit tersebut; silakan pilih unit secara manual.",
        );
      }
      return;
    }

    appliedDeepLink.current = `${deepLink.unitId}:${deepLink.nip}`;
    setDeepLinkMessage(null);
    setSelectedUnitId(verifiedUnit.id);
    setUserSearch(deepLink.nip);
    setUserPage(1);
  }, [deepLink, deepLinkWarning, isLoadingUnits, selectedUnitType, units]);

  const {
    users,
    pagination,
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
  } = useManagementUsers({
    unitId: selectedUnit?.id ?? "",
    search: userSearch,
    page: userPage,
  });

  const {
    releasePicAsync,
    isDeleting,
    toggleStatusAsync,
    isUpdatingStatus,
  } =
    usePicMutation();

  const handleDeleteUser = (user: UserWithUnit) => {
    setConfirmError(null);
    setConfirmModal({
      isOpen: true,
      action: "DELETE",
      user,
    });
  };

  const handleToggleStatus = async (user: UserWithUnit, newStatus: boolean) => {
    setConfirmError(null);
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
  };

  const executeConfirmAction = async () => {
    if (!confirmModal.user) return;

    try {
      if (confirmModal.action === "TOGGLE_STATUS") {
        await toggleStatusAsync({
          userId: confirmModal.user.id,
          isActive: confirmModal.newStatus!,
        });
      } else if (confirmModal.action === "DELETE") {
        await releasePicAsync(confirmModal.user.id);
      }

      await refetchUsers();
    } catch (error) {
      setConfirmError(
        error instanceof Error ? error.message : "Aksi PIC gagal dilakukan",
      );
      return;
    }

    // Tutup modal & reset state
    setConfirmModal({
      isOpen: false,
      action: null,
      user: null,
    });
    setConfirmError(null);
  };
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <AppBar
          title="Manajemen PIC"
          description="Kelola PIC unit kerja BULOG — Kanwil, Kancab, dan Divisi"
          showAddButton={false}
        />

        <SelectUnitType
          value={selectedUnitType}
          onChange={handleUnitTypeChange}
          className="w-full sm:min-w-72"
        />
      </div>

      {deepLinkMessage && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {deepLinkMessage}
        </div>
      )}

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
          isUpdatingStatus={isUpdatingStatus}
          onDelete={handleDeleteUser}
        />
      </div>

      <ModalAddPic
        isOpen={stateModal.isOpen}
        onClose={handleModalSuccess}
        selectedUnit={selectedUnit}
      />

      <ModalConfirmAction
        isOpen={confirmModal.isOpen}
        onClose={() => {
          setConfirmError(null);
          setConfirmModal({ isOpen: false, action: null, user: null });
        }}
        onConfirm={executeConfirmAction}
        isLoading={
          isUpdatingStatus === confirmModal.user?.id ||
          isDeleting === confirmModal.user?.id
        }
        error={confirmError}
        title={
          confirmModal.action === "TOGGLE_STATUS"
            ? confirmModal.newStatus
              ? "Aktifkan PIC"
              : "Nonaktifkan PIC"
            : "Lepas PIC"
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
              Apakah Anda yakin ingin melepas PIC{" "}
              <strong>{confirmModal.user?.name}</strong>? User tetap tersimpan,
              role menjadi VIEWER, akun nonaktif, Employee link tetap ada.
            </span>
          )
        }
        confirmText={
          confirmModal.action === "TOGGLE_STATUS"
            ? confirmModal.newStatus
              ? "Ya, Aktifkan"
              : "Ya, Nonaktifkan"
            : "Ya, Lepas PIC"
        }
      />
    </div>
  );
}
