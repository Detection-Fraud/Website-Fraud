"use client";

import AppBar from "@/components/layout/Appbar";
import FilterCategory from "@/components/ui/FilterCategory";
import ReportSearchBar from "@/components/ui/ReportSearchBar";
import SelectDivisi from "@/components/ui/SelectDivisi";
import SelectKancab from "@/components/ui/SelectKancab";
import SelectUnitType, { UnitTypeFilter } from "@/components/ui/SelectUnitType";
import SelectWilayah from "@/components/ui/SelectWilayah";
import StatusTagGroup from "@/components/ui/StatusTagGroup";
import SummaryCards from "@/components/ui/SummaryCard";
import { useApproval } from "@/hooks/useApproval";
import { useReportList } from "@/hooks/useReportList";
import { api } from "@/lib/api";
import { Button, Card, toast, useOverlayState } from "@heroui/react";

import FilterProgram from "@/components/ui/FilterProgram";
import { ActivityReportItem } from "@/types/report.types";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useRef, useState } from "react";
import { BsCheck2Circle, BsXCircle } from "react-icons/bs";
import { CiSaveDown1 } from "react-icons/ci";
import { FiAlertTriangle, FiFileText, FiImage } from "react-icons/fi";
import CardApproval from "./CardApproval";
import ModalLogs from "./ModalLogs";
import ModalNotes from "./ModalNotes";
import PaginationFooter from "../../../../../components/ui/PaginationFooter";
import ParticipationScoreModal from "./ParticipationScoreModal";

const SCOPE_MAP: Partial<Record<UnitTypeFilter, string>> = {
  WILAYAH: "KANWIL_ONLY",
  WILAYAH_AND_CABANG: "KANWIL_AND_KANCAB",
  CABANG: "KANCAB",
  DIVISI: "DIVISI",
};

export default function ApprovalView() {
  const {
    reports,
    pagination,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    kanwilId,
    kancabId,
    kanwilList,
    kancabList,
    divisiId,
    divisiList,
    statusFilter,
    summary,
    categoryFilter,
    programFilter,
    categoryList,
    scopeFilter,
    handleStatusChange,
    handleCategoryChange,
    handleProgramChange,
    handleScopeChange,
    handleKanwilChange,
    handleKancabChange,
    handleDivisiChange,
    handlePageChange,
  } = useReportList({ defaultStatus: "PENDING", purpose: "EVIDENCE" });

  const { handleApprove } = useApproval();

  const state = useOverlayState();
  const logsModalState = useOverlayState();

  const [selectedReport, setSelectedReport] =
    useState<ActivityReportItem | null>(null);

  const [selectedLogsReport, setSelectedLogsReport] =
    useState<ActivityReportItem | null>(null);
  const [scoreReportId, setScoreReportId] = useState<string | null>(null);
  const [scoreReportName, setScoreReportName] = useState<string | undefined>();
  const scoreReturnFocusRef = useRef<HTMLButtonElement | null>(null);

  const selectedScope: UnitTypeFilter = scopeFilter;

  const selectedCategory = categoryFilter || "ALL";

  const handleOpenRejectModal = (report: ActivityReportItem) => {
    setSelectedReport(report);
    state.open();
  };

  const handleCloseRejectModal = () => {
    setSelectedReport(null);
    state.close();
  };

  const handleOpenLogsModal = (report: ActivityReportItem) => {
    setSelectedLogsReport(report);
    logsModalState.open();
  };

  const handleCloseLogsModal = () => {
    setSelectedLogsReport(null);
    logsModalState.close();
  };

  const handleApproveReport = async (
    id: string,
    trigger: HTMLButtonElement,
  ) => {
    try {
      const result = await handleApprove(id);
      if (result.nextAction?.type !== "ENTER_PARTICIPATION_SCORE") return;

      scoreReturnFocusRef.current = trigger;
      setScoreReportId(result.nextAction.reportId);
      setScoreReportName(
        reports.find((report) => report.id === id)?.activityName,
      );
    } catch {
      // useApproval owns error feedback; do not compensate a committed approval.
    }
  };

  const closeScoreModal = () => {
    setScoreReportId(null);
    setScoreReportName(undefined);
    const trigger = scoreReturnFocusRef.current;
    scoreReturnFocusRef.current = null;
    queueMicrotask(() => {
      if (trigger?.isConnected && !trigger.disabled) trigger.focus();
    });
  };

  // Logic Disabled Export Button
  const apiScope = SCOPE_MAP[selectedScope];

  const isExportDisabled =
    programFilter === "ALL" ||
    !apiScope ||
    ((selectedScope === "WILAYAH" || selectedScope === "WILAYAH_AND_CABANG") &&
      (!kanwilId || kanwilId === "ALL")) ||
    (selectedScope === "CABANG" && (!kancabId || kancabId === "ALL")) ||
    (selectedScope === "DIVISI" && (!divisiId || divisiId === "ALL"));

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!apiScope || programFilter === "ALL") {
        throw new Error("Pilih program dan scope sebelum export");
      }

      const params: Record<string, string> = {
        programId: programFilter,
        scope: apiScope,
      };

      if (
        selectedScope === "WILAYAH" ||
        selectedScope === "WILAYAH_AND_CABANG"
      ) {
        params.kanwilId = kanwilId;
      } else if (selectedScope === "CABANG") {
        params.kancabId = kancabId;
      } else if (selectedScope === "DIVISI") {
        params.divisiId = divisiId;
      }

      return api.get("/reports/export-collage", {
        params,
        responseType: "blob",
      });
    },
    onSuccess: (response) => {
      const url = window.URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      const contentDisposition = response.headers["content-disposition"];
      const fileName =
        contentDisposition?.match(/filename="?([^"]+)"?/)?.[1] ??
        "Kolase_Foto_Kegiatan.pdf";

      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Kolase foto berhasil diunduh!");
    },
    onError: async (error) => {
      let message = "Terjadi kesalahan jaringan saat mengunduh PDF";

      if (axios.isAxiosError(error)) {
        const payload: unknown = error.response?.data;
        if (payload instanceof Blob) {
          try {
            const parsed: unknown = JSON.parse(await payload.text());
            if (
              parsed &&
              typeof parsed === "object" &&
              "message" in parsed &&
              typeof parsed.message === "string"
            ) {
              message = parsed.message;
            }
          } catch {
            // Response bukan JSON; gunakan pesan fallback.
          }
        }
      } else if (error instanceof Error) {
        message = error.message;
      }

      toast.danger(message);
    },
  });

  const isExporting = exportMutation.isPending;

  // UPDATED: Summary Cards with Slate tokens & calibrated status colors
  const summaryCards = [
    {
      title: "Total Upload",
      value: summary.total,
      description: "Semua Unggahan",
      icon: FiImage,
      style: "text-blue-600 bg-blue-50 border border-blue-100",
      textColor: "text-blue-700",
    },
    {
      title: "Menunggu",
      value: summary.pending,
      description: "Total Menunggu",
      icon: FiAlertTriangle,
      style: "bg-amber-50 text-amber-600 border border-amber-100",
      textColor: "text-amber-700",
    },
    {
      title: "Disetujui",
      value: summary.approved,
      icon: BsCheck2Circle,
      description: "Total Disetujui",
      style: "bg-emerald-50 text-emerald-600 border border-emerald-100",
      textColor: "text-emerald-700",
    },
    {
      title: "Ditolak",
      value: summary.rejected,
      icon: BsXCircle,
      description: "Total Ditolak",
      style: "bg-rose-50 text-rose-600 border border-rose-100",
      textColor: "text-rose-700",
    },
  ];

  // Helper boolean untuk Contextual Adaptive Filter
  const showWilayah =
    selectedScope === "WILAYAH" ||
    selectedScope === "WILAYAH_AND_CABANG" ||
    selectedScope === "CABANG";

  const showKancab = selectedScope === "CABANG";
  const showDivisi = selectedScope === "DIVISI";

  return (
    <div className="space-y-6 mb-10">
      <AppBar
        title="Admin Approval"
        description="Daftar foto kegiatan yang telah diupload oleh Kanwil, Kancab, dan Divisi"
        showAddButton={false}
      />

      {/* SUMMARY CARDS SECTION */}
      <SummaryCards summary={summaryCards} />

      {/* ADAPTIVE CONTEXTUAL TOOLBAR CARD */}
      <Card className="shadow-surface hover:shadow-surface-md transition-all duration-200 border border-slate-200/60 rounded-2xl p-4 sm:p-5 space-y-4 bg-white">
        {/* BARIS 1: ADAPTIVE DROPDOWNS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:flex xl:flex-wrap gap-3 items-center">
          {/* 1. Kategori Budaya */}
          <FilterCategory
            value={selectedCategory}
            className="w-full xl:w-56"
            categories={categoryList}
            onChange={handleCategoryChange}
          />

          {/* 2. Program Budaya (Cascading di bawah Kategori) */}
          <FilterProgram
            value={programFilter || "ALL"}
            categoryId={selectedCategory}
            isDisabled={!selectedCategory || selectedCategory === "ALL"}
            className="w-full xl:w-56"
            onChange={handleProgramChange}
          />

          {/* 3. Tipe Unit Scope */}
          <SelectUnitType
            value={selectedScope}
            onChange={handleScopeChange}
            className="w-full xl:w-52"
            showKanwilAndKancab={true}
          />

          {/* 4. Kantor Wilayah (Hanya tampil jika scope Wilayah/Cabang) */}
          {showWilayah && (
            <SelectWilayah
              regions={kanwilList}
              value={kanwilId}
              className="w-full xl:w-52"
              isDisabled={false}
              onChange={handleKanwilChange}
            />
          )}

          {/* 5. Kantor Cabang (Hanya tampil jika scope Cabang) */}
          {showKancab && (
            <SelectKancab
              branches={kancabList}
              value={kancabId}
              className="w-full xl:w-52"
              isDisabled={kanwilId === "ALL" || kanwilList.length === 0}
              onChange={handleKancabChange}
            />
          )}

          {/* 6. Divisi (Hanya tampil jika scope Divisi/Pusat) */}
          {showDivisi && (
            <SelectDivisi
              divisiList={divisiList}
              value={divisiId}
              className="w-full xl:w-52"
              isDisabled={false}
              onChange={handleDivisiChange}
            />
          )}
        </div>

        {/* DIVIDER */}
        <div className="border-t border-slate-100" />

        {/* BARIS 2: STATUS PILLS & ACTION BAR */}
        <div className="flex flex-col md:flex-row w-full items-stretch md:items-center justify-between gap-3">
          <div className="overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <StatusTagGroup
              value={statusFilter}
              onChange={handleStatusChange}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="w-full sm:w-64">
              <ReportSearchBar
                value={searchInput}
                onChange={setSearchInput}
                onSearch={handleSearch}
                onClear={handleClearSearch}
              />
            </div>

            {/* EXPORT KOLASE BUTTON */}
            <Button
              variant="outline"
              className="rounded-xl font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition-all active:scale-[0.98] shrink-0 w-full sm:w-auto h-11"
              isDisabled={isExportDisabled || isExporting}
              onPress={() => exportMutation.mutate()}
            >
              <CiSaveDown1 className="text-lg text-slate-500" />
              {isExporting ? "Mengunduh..." : "Export Kolase"}
            </Button>
          </div>
        </div>
      </Card>

      {/* APPROVAL ITEMS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {reports.length > 0 ? (
          reports.map((report: ActivityReportItem) => (
            <CardApproval
              key={report.id}
              report={report}
              onApprove={handleApproveReport}
              onOpenScore={(id, trigger) => {
                scoreReturnFocusRef.current = trigger;
                setScoreReportId(id);
                setScoreReportName(report.activityName);
              }}
              onOpenModal={() => handleOpenRejectModal(report)}
              onOpenLogs={() => handleOpenLogsModal(report)}
            />
          ))
        ) : (
          <Card className="col-span-full rounded-2xl border border-slate-200/60 shadow-surface bg-white py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <FiFileText className="w-6 h-6" />
            </div>
            <p className="text-slate-900 font-bold text-base">
              Tidak ada laporan ditemukan
            </p>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              Coba sesuaikan filter status, kategori program, atau kriteria
              pencarian unit Anda.
            </p>
          </Card>
        )}
      </div>

      {selectedReport && (
        <ModalNotes
          isOpen={state.isOpen}
          onClose={handleCloseRejectModal}
          id={selectedReport.id}
          namaPic={selectedReport.createdBy?.name || ""}
        />
      )}

      {selectedLogsReport && (
        <ModalLogs
          isOpen={logsModalState.isOpen}
          onClose={handleCloseLogsModal}
          reportId={selectedLogsReport.id}
          activityName={selectedLogsReport.activityName}
        />
      )}

      <ParticipationScoreModal
        isOpen={scoreReportId !== null}
        reportId={scoreReportId}
        reportName={scoreReportName}
        onClose={closeScoreModal}
      />

      <PaginationFooter
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        itemsPerPage={pagination.limit}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
