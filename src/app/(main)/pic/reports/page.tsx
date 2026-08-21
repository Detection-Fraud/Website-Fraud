import ComplianceReportView from "@/components/compliance/ComplianceReportView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Laporan Kepatuhan Unit Kerja",
  description: "Status kepatuhan pengajuan laporan budaya unit kerja Anda",
};
export default function ReportsPagePic() {
  return (
    <div className="mb-10">
      <ComplianceReportView />
    </div>
  );
}
