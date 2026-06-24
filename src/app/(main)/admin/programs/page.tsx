"use client";

import AppBar from "@/components/layout/Appbar";
import { useProgramMutation } from "@/hooks/useProgramMutation";
import { useProgramQuery } from "@/hooks/useProgramQuery";
import { SearchField } from "@heroui/react";
import CardPrograms from "./_components/CardPrograms";
import CardSummaryPrograms from "./_components/CardSummaryPrograms";
import ModalForm from "./_components/ModalForm";
import ModalStatus from "./_components/ModalStatus";

export default function ProgramsPage() {
  const {
    modalState,
    selectedProgram,
    isActionLoading,
    handleToggleClick,
    handleConfirmToggle,
    modalAddState,
    handleAddToggleClick,
    handleAddProgram,
    handleEditToggleClick,
  } = useProgramMutation();

  const {
    programs,
    isLoading,
    error,
    summary,
    pagination,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    updateParams,
  } = useProgramQuery();

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
