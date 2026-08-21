import { ListBox, Select } from "@heroui/react";

interface RankingPartisipasiFiltersProps {
  unitType: string;
  onUnitTypeChange: (val: string) => void;
  tw: string;
  onTwChange: (val: string) => void;
}

export function RankingPartisipasiFilters({
  unitType,
  onUnitTypeChange,
  tw,
  onTwChange,
}: RankingPartisipasiFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Filter Tipe Unit"
        className="w-42"
        value={unitType}
        onChange={(key) => onUnitTypeChange((key ?? "ALL") as string)}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="ALL" textValue="Semua Unit"><ListBox.ItemIndicator />Semua Unit Kerja</ListBox.Item>
            <ListBox.Item id="WILAYAH" textValue="Kanwil"><ListBox.ItemIndicator />Kantor Wilayah</ListBox.Item>
            <ListBox.Item id="CABANG" textValue="Kancab"><ListBox.ItemIndicator />Kantor Cabang</ListBox.Item>
            <ListBox.Item id="DIVISI" textValue="Divisi"><ListBox.ItemIndicator />Divisi</ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        aria-label="Filter Triwulan"
        className="w-32"
        value={tw}
        onChange={(key) => onTwChange((key ?? "ALL") as string)}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="ALL" textValue="Semua TW"><ListBox.ItemIndicator />Semua TW</ListBox.Item>
            <ListBox.Item id="1" textValue="TW I"><ListBox.ItemIndicator />TW I</ListBox.Item>
            <ListBox.Item id="2" textValue="TW II"><ListBox.ItemIndicator />TW II</ListBox.Item>
            <ListBox.Item id="3" textValue="TW III"><ListBox.ItemIndicator />TW III</ListBox.Item>
            <ListBox.Item id="4" textValue="TW IV"><ListBox.ItemIndicator />TW IV</ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
