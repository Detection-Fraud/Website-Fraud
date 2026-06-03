import { Label, ListBox, Select } from "@heroui/react";

// Type minimal — kompatibel dengan FilterOption[], Branch[], atau type apapun yang punya id & name
type BranchOption = { id: string; name: string };

interface SelectKancabProps {
  branches: BranchOption[];
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  className?: string;
  labelOff?: boolean;
}

export default function SelectKancab({
  branches,
  value,
  onChange,
  isDisabled = false,
  className = "w-52",
  labelOff = false,
}: SelectKancabProps) {
  return (
    <Select
      aria-label="Pilih Kantor Cabang"
      className={className}
      placeholder="Semua Kantor Cabang"
      isDisabled={isDisabled}
      value={value}
      onChange={(key) => onChange((key ?? "ALL") as string)}
    >
      <Label className={labelOff ? "sr-only" : ""}>Kantor Cabang</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className={"w-fit max-w-64"}>
        <ListBox>
          <ListBox.Item id="ALL" textValue="Semua Kantor Cabang">
            Semua Cabang
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {branches?.map((branch) => (
            <ListBox.Item
              key={branch.id}
              id={String(branch.id)}
              textValue={branch.name}
            >
              {branch.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
