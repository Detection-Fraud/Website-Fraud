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

export default function ManagementUserView() {
  const [selectedUnitType, setSelectedUnitType] = useState<string>("KANWIL");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("ALL");

  const [unitSearch, setUnitSearch] = useState<string>("");

  const [userSearch, setUserSearch] = useState<string>("");

  const [userPage, setUserPage] = useState<number>(1);

  const [editingUser, setEditingUser] = useState<UserWithUnit | null>(null);

  const stateModal = useOverlayState();

  const { units, isLoading: isLoadingUnits } = useUnitList(selectedUnitType);
  const {
    users,
    pagination,
    isLoading: isLoadingUsers,
    refetch,
  } = useManagementUsers({
    unitId: selectedUnitId,
    search: userSearch,
    page: userPage,
  });

  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? null;

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

  const handleDeleteUser = (user: UserWithUnit) => {
    // TODO: implementasi konfirmasi delete di STEP 8
    console.log("Delete user:", user.id);
  };

  const handleModalSuccess = () => {
    stateModal.close();
    setEditingUser(null);
    refetch(); // refresh tabel
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
          onChange={(value) => setSelectedUnitType(value)}
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
          onEdit={handleEditUser}
          onDelete={handleDeleteUser}
        />
      </div>
    </div>
  );
}
