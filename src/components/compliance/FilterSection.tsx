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
          <Select
            aria-label="Filter Program Budaya"
            placeholder="Semua Program Budaya"
            variant="primary"
            className={"w-59"}
            name="program-budaya"
            value={filters.programId}
            onChange={(key) => {
              handleProgramChange((key ?? "ALL") as string);
            }}
          >
            <Label className="text-[#64748b] text-xs font-bold uppercase tracking-tighter">
              Program Budaya
            </Label>
            <Select.Trigger className="shadow-sm bg-white border border-gray-200">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="ALL" textValue="Semua Program Budaya">
                  <ListBox.ItemIndicator />
                  Semua Program Budaya
                </ListBox.Item>
                {options?.programList?.map((program) => (
                  <ListBox.Item
                    key={program.id}
                    id={String(program.id)}
                    textValue={program.name}
                  >
                    <ListBox.ItemIndicator />
                    {program.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          {!hideSelectWilayah &&
            (activeTab === "REGION_AND_BRANCH" ||
              activeTab === "REGION" ||
              activeTab === "BRANCH") && (
              <Select
                aria-label="Filter Wilayah"
                placeholder="Semua Wilayah"
                name="kantor-wilayah"
                variant="primary"
                className={"w-48"}
                value={filters.regionId}
                onChange={(key) => {
                  handleRegionChange((key ?? "ALL") as string);
                }}
              >
                <Label className="text-[#64748b] text-xs font-bold uppercase tracking-tighter">
                  Wilayah
                </Label>
                <Select.Trigger className="shadow-sm bg-white border border-gray-200">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="ALL" textValue="Semua Wilayah">
                      <ListBox.ItemIndicator />
                      Semua Wilayah
                    </ListBox.Item>
                    {options?.regionsList?.map((region) => (
                      <ListBox.Item
                        key={region.id}
                        id={String(region.id)}
                        textValue={region.name}
                      >
                        <ListBox.ItemIndicator />
                        {region.name}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}

          {!hideSelectKancab && activeTab === "BRANCH" && (
            <Select
              aria-label="Filter Kantor Cabang"
              placeholder="Semua Cabang"
              variant="primary"
              className={"w-59"}
              name="kantor-cabang"
              isDisabled={
                !options?.branchList || options.branchList.length === 0
              }
              value={filters.branchId}
              onChange={(key) => {
                handleBranchChange((key ?? "ALL") as string);
              }}
            >
              <Label className="text-[#64748b] text-xs font-bold uppercase tracking-tighter">
                Kantor Cabang
              </Label>
              <Select.Trigger className="shadow-sm bg-white border border-gray-200">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="ALL" textValue="Semua Cabang">
                    <ListBox.ItemIndicator />
                    Semua Cabang
                  </ListBox.Item>
                  {options?.branchList?.map((branch) => (
                    <ListBox.Item
                      key={branch.id}
                      id={String(branch.id)}
                      textValue={branch.name}
                    >
                      <ListBox.ItemIndicator />
                      {branch.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
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
