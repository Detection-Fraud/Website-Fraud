"use client";

import AppBar from "@/components/layout/Appbar";
import { useProgramMutation } from "@/hooks/useProgramMutation";
import { useProgramQuery } from "@/hooks/useProgramQuery";
import { Pagination } from "@heroui/react";
import CardPrograms from "./_components/CardPrograms";
import CardSummaryPrograms from "./_components/CardSummaryPrograms";
import FilterPrograms from "./_components/FilterPropgrams";
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
    summary,
    pagination,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    categoryId,
    tw,
    status,
    hasActiveFilters,
    handleFilterCategory,
    handleFilterTw,
    handleFilterStatus,
    handleResetAllFilters,
    updateParams,
  } = useProgramQuery();

  return (
    <div className="space-y-6 mb-10">
      <AppBar
        title="Program Budaya"
        description="Kelola master data program kegiatan budaya BULOG"
        textAddButton="Tambah Program"
        onAdd={handleAddToggleClick}
      />

      <CardSummaryPrograms data={summary} />

      <FilterPrograms
        totalItems={pagination.total}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearch}
        onSearchClear={handleClearSearch}
        categoryId={categoryId}
        onCategoryChange={handleFilterCategory}
        tw={tw}
        onTwChange={handleFilterTw}
        status={status}
        onStatusChange={handleFilterStatus}
        onResetFilters={handleResetAllFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <CardPrograms
        programs={programs}
        onToggleStatus={handleToggleClick}
        onEdit={handleEditToggleClick}
      />

      {/* Pagination Container */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-sm text-zinc-500">
            Total{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {pagination.total}
            </span>{" "}
            program
          </div>
          <Pagination className="justify-center">
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={pagination.page === 1}
                  onPress={() =>
                    updateParams({ page: (pagination.page - 1).toString() })
                  }
                >
                  <Pagination.PreviousIcon />
                  <span>Prev</span>
                </Pagination.Previous>
              </Pagination.Item>
              {Array.from(
                { length: pagination.totalPages },
                (_, i) => i + 1,
              ).map((p) => (
                <Pagination.Item key={p}>
                  <Pagination.Link
                    isActive={p === pagination.page}
                    onPress={() => updateParams({ page: p.toString() })}
                  >
                    {p}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={pagination.page === pagination.totalPages}
                  onPress={() =>
                    updateParams({ page: (pagination.page + 1).toString() })
                  }
                >
                  <span>Next</span>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </div>
      )}

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
