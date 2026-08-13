"use client";

import AppBar from "@/components/layout/Appbar";
import { useReportList } from "@/hooks/useReportList";
import { Button, Card, toast, useOverlayState } from "@heroui/react";

import FilterCategory from "@/components/ui/FilterCategory";
import ReportSearchBar from "@/components/ui/ReportSearchBar";
import SelectDivisi from "@/components/ui/SelectDivisi";
import SelectKancab from "@/components/ui/SelectKancab";
import SelectUnitType, { UnitTypeFilter } from "@/components/ui/SelectUnitType";
import SelectWilayah from "@/components/ui/SelectWilayah";
import StatusTagGroup from "@/components/ui/StatusTagGroup";
import SummaryCards from "@/components/ui/SummaryCard";
import { useApproval } from "@/hooks/useApproval";
import { ActivityReportItem } from "@/types/report.types";
import { useState } from "react";
import { BsCheck2Circle, BsXCircle } from "react-icons/bs";
import { CiSaveDown1 } from "react-icons/ci";
import { FiAlertTriangle, FiFileText, FiImage } from "react-icons/fi";
import CardApproval from "./CardApproval";
import ModalLogs from "./ModalLogs";
import ModalNotes from "./ModalNotes";
import PaginationFooter from "./PaginationFooter";

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
    updateParams,
    kanwilId,
    kancabId,
    setKanwilId,
    setKancabId,
    kanwilList,
    kancabList,
    divisiId,
    setDivisiId,
    divisiList,
    router,
    statusFilter,
    summary,
    categoryFilter,
    categoryList,
  } = useReportList();

  const { handleApprove, isLoading: isApproving } = useApproval();

  const state = useOverlayState();
  const logsModalState = useOverlayState();

  const [selectedReport, setSelectedReport] =
    useState<ActivityReportItem | null>(null);

  const [selectedLogsReport, setSelectedLogsReport] =
    useState<ActivityReportItem | null>(null);

  const [selectedScope, setSelectedScope] = useState<UnitTypeFilter>(() => {
    if (divisiId && divisiId !== "ALL") return "DIVISI";
    if (kancabId && kancabId !== "ALL") return "CABANG";
    if (kanwilId && kanwilId !== "ALL") return "WILAYAH";
    return "ALL";
  });

  const selectedCategory = categoryFilter || "ALL";

  const [isExporting, setIsExporting] = useState(false);

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

  const handleApproveReport = (id: string) => {
    handleApprove(id);
  };

  const handleScopeChange = (newScope: UnitTypeFilter) => {
    setSelectedScope(newScope);

    if (newScope === "DIVISI") {
      setKanwilId("ALL");
      setKancabId("ALL");
      updateParams({ kanwilId: "", kancabId: "", page: "1" });
    } else if (newScope === "WILAYAH" || newScope === "WILAYAH_AND_CABANG") {
      setDivisiId("ALL");
      setKancabId("ALL");
      updateParams({ divisiId: "", kancabId: "", page: "1" });
    } else if (newScope === "CABANG") {
      setDivisiId("ALL");
      updateParams({ divisiId: "", page: "1" });
    } else if (newScope === "ALL") {
      setDivisiId("ALL");
      setKanwilId("ALL");
      setKancabId("ALL");
      updateParams({
        divisiId: "",
        kanwilId: "",
        kancabId: "",
        page: "1",
      });
    }
  };

  // Logic Disabled Export Button
  const apiScope = SCOPE_MAP[selectedScope];

  const isExportDisabled =
    !selectedCategory ||
    selectedCategory === "ALL" ||
    !apiScope || // scope belum dipilih
    ((selectedScope === "WILAYAH" || selectedScope === "WILAYAH_AND_CABANG") &&
      (!kanwilId || kanwilId === "ALL")) ||
    (selectedScope === "CABANG" && (!kancabId || kancabId === "ALL")) ||
    (selectedScope === "DIVISI" && (!divisiId || divisiId === "ALL"));

  // Handler Button Export (Fetch + Blob dengan Error Handling & Toast)
  const handleExportKolase = async () => {
    if (!apiScope) return;

    try {
      setIsExporting(true);

      const params = new URLSearchParams();
      params.append("categoryId", selectedCategory);
      params.append("programId", selectedCategory);
      params.append("scope", apiScope);

      if (
        selectedScope === "WILAYAH" ||
        selectedScope === "WILAYAH_AND_CABANG"
      ) {
        params.append("kanwilId", kanwilId);
      }
      if (selectedScope === "CABANG") {
        params.append("kancabId", kancabId);
      }
      if (selectedScope === "DIVISI") {
        params.append("divisiId", divisiId);
      }

      const res = await fetch(
        `/api/reports/export-collage?${params.toString()}`,
      );

      if (!res.ok) {
        let errorMessage =
          "Gagal meng-export kolase foto / Tidak ada reports yang sudah di approved";
        try {
          const errJson = await res.json();
          if (errJson?.message) errorMessage = errJson.message;
        } catch {
          // ignore error if parsing JSON fails
        }
        toast.danger(errorMessage);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const contentDisposition = res.headers.get("Content-Disposition");
      let fileName = "Kolase_Foto_Kegiatan.pdf";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) fileName = match[1];
      }

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Kolase foto berhasil diunduh!");
    } catch (error) {
      toast.danger("Terjadi kesalahan jaringan saat mengunduh PDF");
    } finally {
      setIsExporting(false);
    }
  };

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

  return (
    <div className="space-y-6 mb-10">
      <AppBar
        title="Admin Approval"
        description="Daftar foto kegiatan yang telah diupload oleh Kanwil, Kancab, dan Divisi"
        showAddButton={false}
      />

      {/* SUMMARY CARDS SECTION */}
      <SummaryCards summary={summaryCards} />

      {/* UPDATED: Unified Toolbar Control Card Surface (rounded-2xl border-slate-200/60 shadow-surface) */}
      <Card className="shadow-surface hover:shadow-surface-md transition-all duration-200 border border-slate-200/60 rounded-2xl p-4 sm:p-5 space-y-4 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* 1. Program */}
          <FilterCategory
            value={selectedCategory}
            className="w-full"
            categories={categoryList}
            onChange={(val) =>
              updateParams({
                categoryId: val === "ALL" ? "" : val,
                programId: val === "ALL" ? "" : val,
                page: "1",
              })
            }
          />

          {/* 2. Tipe Unit */}
          <SelectUnitType
            value={selectedScope}
            onChange={handleScopeChange}
            className="w-full"
            showKanwilAndKancab={true}
          />

          {/* 3. Kantor Wilayah */}
          <SelectWilayah
            regions={kanwilList}
            value={kanwilId}
            className="w-full"
            isDisabled={selectedScope === "ALL" || selectedScope === "DIVISI"}
            onChange={(val) => {
              setKanwilId(val);
              updateParams({
                kanwilId: val === "ALL" ? "" : val,
                kancabId: "",
                divisiId: "",
                page: "1",
              });
            }}
          />

          {/* 4. Kantor Cabang */}
          <SelectKancab
            branches={kancabList}
            value={kancabId}
            className="w-full"
            isDisabled={
              selectedScope === "ALL" ||
              selectedScope === "DIVISI" ||
              selectedScope === "WILAYAH" ||
              selectedScope === "WILAYAH_AND_CABANG" ||
              kanwilId === "ALL" ||
              kanwilList.length === 0
            }
            onChange={(val) => {
              setKancabId(val);
              updateParams({
                kancabId: val === "ALL" ? "" : val,
                divisiId: "",
                page: "1",
              });
            }}
          />
          {/* 5. Divisi */}
          <SelectDivisi
            divisiList={divisiList}
            value={divisiId}
            className="w-full"
            isDisabled={
              selectedScope === "ALL" ||
              selectedScope === "WILAYAH" ||
              selectedScope === "WILAYAH_AND_CABANG" ||
              selectedScope === "CABANG"
            }
            onChange={(val) => {
              setDivisiId(val);
              updateParams({
                divisiId: val === "ALL" ? "" : val,
                kanwilId: "",
                kancabId: "",
                page: "1",
              });
            }}
          />
        </div>
        <div className="border-t border-slate-100" />

        <div className="flex flex-col md:flex-row w-full items-stretch md:items-center justify-between gap-3">
          <div className="overflow-x-auto pb-1 md:pb-0">
            <StatusTagGroup
              value={statusFilter}
              onChange={(status) =>
                updateParams({
                  status: status === "ALL" ? "" : status,
                  page: "1",
                })
              }
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
            {/* UPDATED: Export Button styling */}
            <Button
              variant="outline"
              className="rounded-xl font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition-all active:scale-[0.98] shrink-0 w-full sm:w-auto h-11"
              isDisabled={isExportDisabled || isExporting}
              onPress={handleExportKolase}
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
              onOpenModal={() => handleOpenRejectModal(report)}
              onOpenLogs={() => handleOpenLogsModal(report)}
            />
          ))
        ) : (
          /* UPDATED: Rich Empty State Card */
          <Card className="col-span-full rounded-2xl border border-slate-200/60 shadow-surface bg-white py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <FiFileText className="w-6 h-6" />
            </div>
            <p className="text-slate-900 font-bold text-base">Tidak ada laporan ditemukan</p>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              Coba sesuaikan filter status, kategori program, atau kriteria pencarian unit Anda.
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
      <PaginationFooter
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        itemsPerPage={pagination.limit}
        onPageChange={(pageNumber) =>
          updateParams({
            page: pageNumber.toString(),
          })
        }
      />
    </div>
  );
}
