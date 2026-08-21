import { Metadata } from "next";
import ApprovalView from "./_components/ApprovalView";

export const metadata: Metadata = {
  title: "Approval Laporan Kegiatan",
  description: "Persetujuan dan validasi laporan kegiatan budaya dari Culture Catalyst & PIC",
};


export default function AdminApproval() {
  return (
    <div className="w-full ">
      <ApprovalView />
    </div>
  );
}
