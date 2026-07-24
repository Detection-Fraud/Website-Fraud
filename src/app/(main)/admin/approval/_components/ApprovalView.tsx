"use client";

import AppBar from "@/components/layout/Appbar";
import { useReportList } from "@/hooks/useReportList";
import { Button, Card, toast, useOverlayState } from "@heroui/react";

import FilterProgram from "@/components/ui/FilterProgram";
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
import { FiAlertTriangle, FiImage } from "react-icons/fi";
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
    programFilter,
    summary,
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
    !programFilter ||
    programFilter === "ALL" ||
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
      params.append("programId", programFilter);
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

  const summaryCards = [
    {
      title: "Total Upload",
      value: summary.total,
      description: "Semua Unggahan",
      icon: FiImage,
      style: "text-blue-600 bg-blue-100",
      textColor: "text-[#0284c7]",
    },
    {
      title: "Menunggu",
      value: summary.pending,
      description: "Total Menunggu",
      icon: FiAlertTriangle,
      style: "bg-orange-100 text-orange-600",
      textColor: "text-[#d97706]",
    },
    {
      title: "Disetujui",
      value: summary.approved,
      icon: BsCheck2Circle,
      description: "Total Disetujui",
      style: "bg-green-100 text-green-600",
      textColor: "text-[#059669]",
    },
    {
      title: "Ditolak",
      value: summary.rejected,
      icon: BsXCircle,
      description: "Total Ditolak",
      style: "bg-red-100 text-red-600",
      textColor: "text-[#dc2626]",
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

      {/* UNIFIED TOOLBAR CONTROL CARD */}
      <Card className="shadow-sm border border-slate-200/80 rounded-xl p-4 space-y-4 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
          {/* 1. Program */}
          <FilterProgram
            value={programFilter}
            className="w-full"
            onChange={(val) =>
              updateParams({ programId: val === "ALL" ? "" : val, page: "1" })
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
            <Button
              variant="outline"
              className="rounded-xl font-medium border-slate-300 hover:bg-slate-50 transition-colors shrink-0 w-full sm:w-auto h-11"
              isDisabled={isExportDisabled || isExporting}
              onPress={handleExportKolase}
            >
              <CiSaveDown1 className="text-lg" />
              {isExporting ? "Mengunduh..." : "Export Kolase"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="col-span-full text-center py-10 text-slate-400 text-sm">
            Tidak ada laporan
          </div>
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
