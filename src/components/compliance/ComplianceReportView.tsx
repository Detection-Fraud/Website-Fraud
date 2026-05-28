"use client";

import CardCompliance from "@/components/compliance/CardCompliance";
import FilterSection from "@/components/compliance/FilterSection";
import TableCompliance from "@/components/compliance/TableCompliance";
import TableIndicators from "@/components/compliance/TableIndicators";
import AppBar from "@/components/layout/Appbar";
import { useComplianceReport } from "@/hooks/useComplianceReport";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function ComplianceReportView() {
  const {
    activeTab,
    handleTabChange,
    filters,
    options,
    data,
    isLoading,
    handleKancabChange,
    handleDivisiChange,
    handleProgramChange,
    handleKanwilChange,
  } = useComplianceReport();

  const { user } = useCurrentUser();
  let defaultTab = "NASIONAL";
  if (user?.role === "PIC") {
    if (user.unitType === "KANTOR_WILAYAH") defaultTab = "KANWIL_AND_KANCAB";
    else if (user.unitType === "KANTOR_CABANG") defaultTab = "KANCAB";
    else if (user.unitType === "DIVISI") defaultTab = "DIVISI";
  }

  const isFilterActive =
    filters.kanwilId !== "ALL" ||
    filters.kancabId !== "ALL" ||
    filters.divisiId !== "ALL" ||
    filters.programId !== "ALL" ||
    activeTab !== defaultTab;

  const cardComplianceData = data?.cards;
  const selectedProgram =
    data?.programs?.find((p) => p.id === filters.programId) || null;

  return (
    <div className="space-y-4">
      <AppBar
        title="Reports"
        description="Compliance laporan APPROVED per unit · dibandingkan target frekuensi program"
        showAddButton={false}
      />

      <div>
        <FilterSection
          filters={filters}
          options={options}
          handleKancabChange={handleKancabChange}
          handleDivisiChange={handleDivisiChange}
          handleProgramChange={handleProgramChange}
          handleKanwilChange={handleKanwilChange}
          isFilterActive={isFilterActive}
          activeTab={activeTab}
          handleTabChange={handleTabChange}
        />
      </div>

      <div>
        <CardCompliance data={cardComplianceData} />
      </div>

      <div className="space-y-4">
        {filters.programId !== "ALL" && selectedProgram && (
          <TableIndicators data={selectedProgram} />
        )}
        <TableCompliance
          data={data}
          isLoading={isLoading}
          selectedProgramId={filters.programId}
        />
      </div>
    </div>
  );
}
