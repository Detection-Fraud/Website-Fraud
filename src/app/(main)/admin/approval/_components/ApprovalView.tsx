"use client";

import AppBar from "@/components/layout/Appbar";
import { useReportList } from "@/hooks/useReportList";
import { Button, Card, useOverlayState } from "@heroui/react";


import FilterProgram from "@/components/ui/FilterProgram";
import SelectKancab from "@/components/ui/SelectKancab";
import SelectWilayah from "@/components/ui/SelectWilayah";

import ReportSearchBar from "@/components/ui/ReportSearchBar";
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
    <div className="space-y-8 mb-10">
      <AppBar
        title="Admin Approval"
        description="Daftar foto kegiatan yang telah diupload oleh Kanwil, Kancab, dan Divisi"
        showAddButton={false}
      />

      {/* FILTER SECTION */}
      <div className="flex flex-col  sm:flex-row flex-wrap gap-3 justify-start items-stretch sm:items-center">
        <FilterProgram
          value={programFilter}
          className="w-full sm:w-56 lg:w-70"
          onChange={(val) => updateParams({ programId: val, page: "1" })}
        />

        <SelectWilayah
          regions={kanwilList}
          value={kanwilId}
          className="w-full sm:w-56 lg:w-70"
          onChange={(val) => {
            setKanwilId(val);
            updateParams({ page: "1" });
          }}
        />

        <SelectKancab
          branches={kancabList}
          value={kancabId}
          className="w-full sm:w-56 lg:w-70"
          isDisabled={kanwilId === "ALL" || kanwilList.length === 0}
          onChange={(val) => {
            setKancabId(val);
            updateParams({ page: "1" });
          }}
        />
      </div>

      {/* SUMMARY CARDS SECTION */}
      <SummaryCards summary={summaryCards} />

      {/* CARD FILTER & SEARCH */}
      <Card className="shadow-sm border border-gray-200 rounded-lg">
        <div className="flex flex-col md:flex-row w-full items-start md:items-center justify-between gap-3 p-2">
          <Card.Header>
            <div className="flex flex-col gap-0.5 items-start">
              <Card.Title className="font-semibold text-md">
                Daftar Laporan
              </Card.Title>
              <Card.Description className="text-xs text-gray-500">
                {summary.total} data
              </Card.Description>

              <div>
                <StatusTagGroup
                  value={statusFilter}
                  onChange={(status) => updateParams({ status, page: "1" })}
                />
              </div>
            </div>
          </Card.Header>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div>
              <ReportSearchBar
                value={searchInput}
                onChange={setSearchInput}
                onSearch={handleSearch}
                onClear={handleClearSearch}
              />
            </div>
            <div>
              <Button variant="outline" className={"rounded-xl"}>
                <CiSaveDown1 />
                Export
              </Button>
            </div>
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
          namaPic={selectedReport.picKegiatan}
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
