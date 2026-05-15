"use client";

import CardCompliance from "@/components/compliance/CardCompliance";
import ComplianceReportView from "@/components/compliance/ComplianceReportView";
import FilterSection from "@/components/compliance/FilterSection";
import TableCompliance from "@/components/compliance/TableCompliance";
import TableIndicators from "@/components/compliance/TableIndicators";
import AppBar from "@/components/layout/Appbar";
import { useComplianceReport } from "@/hooks/useComplianceReport";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function ReportsPagePic() {
  return <ComplianceReportView />;
}
