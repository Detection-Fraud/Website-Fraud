"use client";

import CardCompliance from "@/components/compliance/CardCompliance";
import FilterSection from "@/components/compliance/FilterSection";
import ParticipationReportSection from "@/components/compliance/ParticipationReportSection";
import RankingPartisipasiSection from "@/components/compliance/RankingPartisipasiSection";
import TableCompliance from "@/components/compliance/TableCompliance";
import TableIndicators from "@/components/compliance/TableIndicators";
import AppBar from "@/components/layout/Appbar";
import { useComplianceReport } from "@/hooks/useComplianceReport";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { QuarterFilter } from "@/types/compliance.types";
import { Tabs } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";

export default function ComplianceReportView() {
  const {
    activeTab,
    handleTabChange,
    kanwilId,
    kancabId,
    divisiId,
    programId,
    year,
    tw,
    options,
    data,
    isLoading,
    setKancabId,
    setDivisiId,
    handleProgramChange,
    setKanwilId,
    handleYearChange,
    handleTwChange,
  } = useComplianceReport();

  const filters = useMemo(
    () => ({ kanwilId, kancabId, divisiId, programId, year, tw }),
    [kanwilId, kancabId, divisiId, programId, year, tw],
  );

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
    filters.tw !== "ALL" ||
    activeTab !== defaultTab;

  const cardComplianceData = data?.cards;
  const selectedProgram =
    data?.programs?.find((p: any) => p.id === filters.programId) || null;

  const [isExporting, setIsExporting] = useState(false);

  // [UPDATED] state mode tab: KEGIATAN atau PARTISIPASI
  const [modeType, setModeType] = useState<"KEGIATAN" | "PARTISIPASI">(
    "KEGIATAN",
  );

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("year", String(filters.year));
      if (filters.tw !== "ALL") params.append("tw", filters.tw);
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

  const isAdmin = user?.role === "ADMIN";

  const renderKegiatanContent = () => (
    <div className="space-y-4 pt-4">
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
          handleTwChange={(value: QuarterFilter) => handleTwChange(value)}
          onExport={handleExport}
          isExporting={isExporting}
          isDataEmpty={!data || data.tableData.length === 0}
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

  return (
    <div className="space-y-4">
      {/* AppBar — shared */}
      <AppBar
        title="Reports"
        description="Compliance laporan APPROVED per unit · dibandingkan target frekuensi program"
        showAddButton={false}
      />

      {isAdmin ? (
        <Tabs
          selectedKey={modeType}
          onSelectionChange={(key) =>
            setModeType(key as "KEGIATAN" | "PARTISIPASI")
          }
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Mode laporan">
              <Tabs.Tab id="KEGIATAN">
                Kegiatan
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="PARTISIPASI">
                Partisipasi
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="KEGIATAN">{renderKegiatanContent()}</Tabs.Panel>

          <Tabs.Panel id="PARTISIPASI">
            <Tabs defaultSelectedKey="VALUE_ONLY">
              <Tabs.ListContainer>
                <Tabs.List aria-label="Jenis laporan partisipasi">
                  <Tabs.Tab id="VALUE_ONLY">
                    Value only
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="WITH_EVIDENCE">
                    Dengan evidence
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel id="VALUE_ONLY">
                <div className="pt-4">
                  <RankingPartisipasiSection />
                </div>
              </Tabs.Panel>
              <Tabs.Panel id="WITH_EVIDENCE">
                <div className="pt-4">
                  <ParticipationReportSection />
                </div>
              </Tabs.Panel>
            </Tabs>
          </Tabs.Panel>
        </Tabs>
      ) : (
        renderKegiatanContent()
      )}
    </div>
  );
}
