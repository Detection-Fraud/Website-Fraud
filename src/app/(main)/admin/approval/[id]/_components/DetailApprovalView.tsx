"use client";

import { useApproval } from "@/hooks/useApproval";
import { useReportDetail } from "@/hooks/useReportDetail";
import { Skeleton, useOverlayState } from "@heroui/react";
import ModalNotes from "./ModalNotes";

import ActivityTimeline from "@/components/reports/ActivityTimeline";
import ApprovalHeader from "./ApprovalHeader";
import ApprovalSidebar from "./ApprovalSidebar";

export default function DetailApprovalView({ id }: { id: string }) {
  const { report, loading } = useReportDetail(id);
  const { isLoading, handleApprove } = useApproval();
  const state = useOverlayState();

  if (loading) {
    return (
      <div className="w-full space-y-6 mb-10 animate-pulse">
        {/* Tombol Back & Judul */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-10 w-3/4 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        {/* Status View */}
        <Skeleton className="h-24 w-full rounded-xl" />
        {/* Grid Konten Bawah */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar */}
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          {/* Galeri Foto */}
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 mb-10">
      <ApprovalHeader
        report={report}
        isLoading={isLoading}
        onApprove={() => handleApprove(id)}
        onReject={state.open}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT SIDEBAR */}
        <div className="lg:col-span-2">
          <ApprovalSidebar report={report} />
        </div>

        {/* RIGHT CONTENT */}
        <div className="lg:col-span-1 space-y-4">
          <ActivityTimeline logs={report?.logs} />
        </div>
      </div>

      <ModalNotes
        isOpen={state.isOpen}
        onClose={state.close}
        namaPic={report?.picKegiatan}
        id={id}
      />
    </div>
  );
}
