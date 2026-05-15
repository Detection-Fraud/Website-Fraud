import { useCurrentUser } from "@/hooks/useCurrentUser";
import { FilterOption, TabUnitType } from "@/types/compliance.types";
import {
  Label,
  ListBox,
  Select,
  Button,
  TagGroup,
  Tag,
  Card,
} from "@heroui/react";
import { useEffect } from "react";
import { FiDownload, FiX } from "react-icons/fi";
import FilterProgram from "../ui/FilterProgram";
import SelectWilayah from "../ui/SelectWilayah";
import SelectKancab from "../ui/SelectKancab";

interface FilterSectionProps {
  filters: {
    regionId: string;
    branchId: string;
    divisionId: string;
    programId: string;
  };
  options: {
    regionsList: FilterOption[];
    divisionList: FilterOption[];
    programList: FilterOption[];
    branchList: FilterOption[];
  };
  handleRegionChange: (value: string) => void;
  handleBranchChange: (value: string) => void;
  handleDivisionChange: (value: string) => void;
  handleProgramChange: (value: string) => void;
  isFilterActive: boolean;
  activeTab: TabUnitType;
  handleTabChange: (key: TabUnitType) => void;
}
export default function FilterSection({
  filters,
  options,
  handleBranchChange,
  handleDivisionChange,
  handleProgramChange,
  handleRegionChange,
  isFilterActive,
  activeTab,
  handleTabChange,
}: FilterSectionProps) {
  const { user } = useCurrentUser();

  const isPICBranch = user?.role === "PIC" && user.branchId;
  const isPICDivision = user?.role === "PIC" && user.divisionId;
  const isPICRegion = user?.role === "PIC" && user.regionId && !user.branchId;

  const hideTags = isPICBranch || isPICDivision;

  const hideTagNasional = isPICRegion;
  const hideTagPusat = isPICRegion;

  const hideSelectWilayah = isPICBranch || isPICDivision || isPICRegion;
  const hideSelectKancab = isPICBranch || isPICDivision;
  const hideSelectDivisi = isPICBranch || isPICRegion;

  useEffect(() => {
    if (isPICRegion && activeTab === "NASIONAL") {
      handleTabChange("REGION_AND_BRANCH");
    }
  }, [isPICRegion, activeTab, handleTabChange]);
  return (
    <Card>
      <Card.Header>
        <Card.Title>Filter</Card.Title>
      </Card.Header>
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
                <Tag id={"REGION_AND_BRANCH"}>Kanwil & Kancab</Tag>
                <Tag id={"REGION"}>Kantor Wilayah</Tag>
                <Tag id={"BRANCH"}>Kantor Cabang</Tag>

                {!hideTagPusat && <Tag id={"DIVISION"}>Kantor Pusat</Tag>}
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
            (activeTab === "REGION_AND_BRANCH" ||
              activeTab === "REGION" ||
              activeTab === "BRANCH") && (
              <SelectWilayah
                regions={options?.regionsList || []}
                value={filters.regionId}
                onChange={(val) => handleRegionChange(val)}
                className="w-48"
              />
            )}

          {!hideSelectKancab && activeTab === "BRANCH" && (
            <SelectKancab
              branches={options?.branchList || []}
              value={filters.branchId}
              isDisabled={
                !options?.branchList || options.branchList.length === 0
              }
              onChange={(val) => handleBranchChange(val)}
              className="w-59"
            />
          )}

          {isFilterActive && (
            <Button
              className={"mt-3 rounded-xl"}
              variant="danger-soft"
              size="sm"
              onPress={() => {
                handleBranchChange("ALL");
                handleDivisionChange("ALL");
                handleProgramChange("ALL");
                handleRegionChange("ALL");
                handleTabChange(isPICRegion ? "REGION_AND_BRANCH" : "NASIONAL");
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
