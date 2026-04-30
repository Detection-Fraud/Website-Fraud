"use client";

import { useReportDetail } from "@/hooks/useReportDetail";
import { useOverlayState } from "@heroui/react";
import { useApproval } from "@/hooks/useApproval";
import ModalNotes from "./ModalNotes";

import ApprovalHeader from "./ApprovalHeader";
import ApprovalSidebar from "./ApprovalSidebar";
import ApprovalPhotos from "./ApprovalPhotos";

export default function DetailApprovalView({ id }: { id: string }) {
  const { report } = useReportDetail(id);
  const { isLoading, handleApprove } = useApproval();
  const state = useOverlayState();

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
        <ApprovalSidebar report={report} />

        {/* RIGHT CONTENT */}
        <div className="lg:col-span-2">
          <ApprovalPhotos report={report} />
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
