import ComplianceReportView from "@/components/compliance/ComplianceReportView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Laporan Kepatuhan Unit",
  description:
    "Monitoring dan verifikasi laporan kegiatan budaya seluruh unit kerja",
};
export default function ReportsPage() {
  return (
    <div className="mb-10">
      <ComplianceReportView />
    </div>
  );
}
