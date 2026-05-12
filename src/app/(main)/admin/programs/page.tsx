"use client";

import AppBar from "@/components/layout/Appbar";
import CardSummaryPrograms from "./_components/CardSummaryPrograms";
import { useProgram } from "@/hooks/useProgram";
import { SearchField } from "@heroui/react";
import CardPrograms from "./_components/CardPrograms";
import ModalStatus from "./_components/ModalStatus";
import ModalForm from "./_components/ModalForm";

export default function ProgramsPage() {
  const {
    summary,
    programs,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    selectedProgram,
    handleToggleClick,
    handleConfirmToggle,
    modalState,
    isActionLoading,

    modalAddState,
    handleAddToggleClick,
    handleEditToggleClick,
    handleAddProgram,
  } = useProgram();

  return (
    <div className="space-y-4 mb-10">
      <AppBar
        title="Program Budaya"
        description="Kelola master data program kegiatan budaya BULOG"
        textAddButton="Tambah Program"
        onAdd={handleAddToggleClick}
      />

      <div>
        <CardSummaryPrograms data={summary} />
      </div>

      <div>
        <SearchField
          className={"max-w-2xs"}
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={handleSearch}
          onClear={handleClearSearch}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Cari Program..." />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      <div>
        <CardPrograms
          programs={programs || []}
          onToggleStatus={handleToggleClick}
          onEdit={handleEditToggleClick}
        />
      </div>

      <ModalStatus
        isOpen={modalState.isOpen}
        onClose={modalState.close}
        program={selectedProgram}
        onConfirm={handleConfirmToggle}
        isLoading={isActionLoading}
      />

      <ModalForm
        isLoading={isActionLoading}
        isOpen={modalAddState.isOpen}
        onClose={modalAddState.close}
        onSubmit={handleAddProgram}
        program={selectedProgram}
      />
    </div>
  );
}
