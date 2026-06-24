import { useCurrentUser } from "@/hooks/useCurrentUser";
import { FilterOption, TabUnitType } from "@/types/compliance.types";
import { Button, Card, Tag, TagGroup } from "@heroui/react";
import { FiDownload, FiX } from "react-icons/fi";
import FilterProgram from "../ui/FilterProgram";
import SelectKancab from "../ui/SelectKancab";
import SelectWilayah from "../ui/SelectWilayah";

interface FilterSectionProps {
  filters: {
    kanwilId: string;
    kancabId: string;
    divisiId: string;
    programId: string;
  };
  options: {
    kanwilList: FilterOption[];
    divisiList: FilterOption[];
    programList: FilterOption[];
    kancabList?: FilterOption[];
  };
  handleKanwilChange: (value: string) => void;
  handleKancabChange: (value: string) => void;
  handleDivisiChange: (value: string) => void;
  handleProgramChange: (value: string) => void;
  isFilterActive: boolean;
  activeTab: TabUnitType;
  handleTabChange: (key: TabUnitType) => void;
}
export default function FilterSection({
  filters,
  options,
  handleKancabChange,
  handleDivisiChange,
  handleProgramChange,
  handleKanwilChange,
  isFilterActive,
  activeTab,
  handleTabChange,
}: FilterSectionProps) {
  const { user } = useCurrentUser();

  const isPICKancab = user?.role === "PIC" && user.unitType === "KANTOR_CABANG";
  const isPICDivisi = user?.role === "PIC" && user.unitType === "DIVISI";
  const isPICKanwil =
    user?.role === "PIC" && user.unitType === "KANTOR_WILAYAH";

  const hideTags = isPICKancab || isPICDivisi;
  const hideTagNasional = isPICKanwil;
  const hideTagPusat = isPICKanwil;

  let defaultTab: TabUnitType = "NASIONAL";
  if (user?.role === "PIC") {
    if (user.unitType === "KANTOR_WILAYAH") defaultTab = "KANWIL_AND_KANCAB";
    else if (user.unitType === "KANTOR_CABANG") defaultTab = "KANCAB";
    else if (user.unitType === "DIVISI") defaultTab = "DIVISI";
  }

  const hideSelectWilayah = isPICKancab || isPICDivisi || isPICKanwil;
  const hideSelectKancab = isPICKancab || isPICDivisi;

  return (
    <Card>
      <Card.Header>{!hideTags && <Card.Title>Filter</Card.Title>}</Card.Header>
      <Card.Content className="space-y-4">
        {!hideTags && (
          <div>
            <TagGroup
              selectedKeys={new Set([activeTab])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as TabUnitType;
                if (selected) handleTabChange(selected);
              }}
              aria-label="Filter Tipe Unit"
              selectionMode="single"
            >
              <TagGroup.List>
                {!hideTagNasional && (
                  <Tag id={"NASIONAL"}>Nasional (Semua)</Tag>
                )}
                <Tag id={"KANWIL_AND_KANCAB"}>Kanwil & Kancab</Tag>
                <Tag id={"KANWIL"}>Kantor Wilayah</Tag>
                <Tag id={"KANCAB"}>Kantor Cabang</Tag>

                {!hideTagPusat && <Tag id={"DIVISI"}>Kantor Pusat</Tag>}
              </TagGroup.List>
            </TagGroup>
          </div>
        )}
        <div className="flex gap-4 items-center">
          <FilterProgram
            value={filters.programId}
            onChange={(val) => handleProgramChange(val)}
          />
          {!hideSelectWilayah &&
            (activeTab === "KANWIL_AND_KANCAB" ||
              activeTab === "KANWIL" ||
              activeTab === "KANCAB") && (
              <SelectWilayah
                regions={options?.kanwilList || []}
                value={filters.kanwilId}
                onChange={(val) => handleKanwilChange(val)}
                className="w-48"
              />
            )}

          {!hideSelectKancab && activeTab === "KANCAB" && (
            <SelectKancab
              branches={options?.kancabList || []}
              value={filters.kancabId}
              isDisabled={
                !options?.kancabList || options.kancabList.length === 0
              }
              onChange={(val) => handleKancabChange(val)}
              className="w-59"
            />
          )}

          {isFilterActive && (
            <Button
              className={"mt-3 rounded-xl"}
              variant="danger-soft"
              size="sm"
              onPress={() => {
                handleKancabChange("ALL");
                handleDivisiChange("ALL");
                handleProgramChange("ALL");
                handleKanwilChange("ALL");
                handleTabChange(defaultTab);
              }}
            >
              <FiX />
              Reset
            </Button>
          )}
          <Button
            variant="secondary"
            className={"mt-3 rounded-xl shadow-sm border border-gray-200"}
          >
            <FiDownload />
            Export
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
