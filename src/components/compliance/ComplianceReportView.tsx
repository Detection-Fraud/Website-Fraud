"use client";

import CardCompliance from "@/components/compliance/CardCompliance";
import FilterSection from "@/components/compliance/FilterSection";
import TableCompliance from "@/components/compliance/TableCompliance";
import TableIndicators from "@/components/compliance/TableIndicators";
import AppBar from "@/components/layout/Appbar";
import { useComplianceReport } from "@/hooks/useComplianceReport";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCallback, useState } from "react";

export default function ComplianceReportView() {
  const {
    activeTab,
    handleTabChange,
    kanwilId,
    kancabId,
    divisiId,
    programId,
    year,
    options,
    data,
    isLoading,
    setKancabId,
    setDivisiId,
    handleProgramChange,
    setKanwilId,
    handleYearChange,
  } = useComplianceReport();

  const filters = { kanwilId, kancabId, divisiId, programId, year };

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
    filters.year !== new Date().getFullYear() ||
    activeTab !== defaultTab;

  const cardComplianceData = data?.cards;
  const selectedProgram =
    data?.programs?.find((p: any) => p.id === filters.programId) || null;

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("year", String(filters.year));
      if (activeTab !== "NASIONAL") params.append("unitType", activeTab);
      if (filters.programId !== "ALL")
        params.append("programId", filters.programId);
      if (filters.kanwilId !== "ALL")
        params.append("kanwilId", filters.kanwilId);
      if (filters.kancabId !== "ALL")
        params.append("kancabId", filters.kancabId);
      if (filters.divisiId !== "ALL")
        params.append("divisiId", filters.divisiId);

      const response = await fetch(
        `/api/reports/compliance/export?${params.toString()}`,
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Export gagal");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      a.download =
        match?.[1] ?? `Rekap_Program_Budaya Tahun ${filters.year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error", error);
    } finally {
      setIsExporting(false);
    }
  }, [activeTab, filters]);

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
          handleKancabChange={setKancabId}
          handleDivisiChange={setDivisiId}
          handleProgramChange={handleProgramChange}
          handleKanwilChange={setKanwilId}
          isFilterActive={isFilterActive}
          activeTab={activeTab}
          handleTabChange={handleTabChange}
          handleYearChange={handleYearChange}
          onExport={handleExport}
          isExporting={isExporting}
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
