import { Label, ListBox, Select } from "@heroui/react";

// Type minimal — kompatibel dengan FilterOption[], RegionWithBranches[], dll
type RegionOption = { id: string; name: string };

interface SelectWilayahProps {
  regions: RegionOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  isDisabled?: boolean;
}

export default function SelectWilayah({
  regions,
  value,
  onChange,
  className = "w-42",
  isDisabled = false,
}: SelectWilayahProps) {
  return (
    <Select
      aria-label="Pilih Wilayah"
      className={className}
      placeholder="Semua Wilayah"
      value={value === "ALL" ? "ALL" : value}
      onChange={(key) => onChange((key ?? "ALL") as string)}
      isDisabled={isDisabled}
    >
      <Label>Wilayah</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className={"w-fit max-w-64"}>
        <ListBox>
          <ListBox.Item id="ALL" textValue="Semua Wilayah">
            Semua Wilayah
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {regions.map((region) => (
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
  );
}
