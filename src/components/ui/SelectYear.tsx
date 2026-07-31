import { Label, ListBox, Select } from "@heroui/react";

interface SelectYearProps {
  value: number;
  onChange: (value: number) => void;
  years?: number[];
  className?: string;
}

export default function SelectYear({
  value,
  onChange,
  years: customYears,
  className = "w-32",
}: SelectYearProps) {
  const currentYear = new Date().getFullYear();
  const years: number[] = (() => {
    if (customYears && customYears.length > 0) {
      return customYears;
    }
    const defaultList: number[] = [];
    for (let y = currentYear + 1; y >= 2024; y--) {
      defaultList.push(y);
    }
    return defaultList;
  })();

  return (
    <Select
      aria-label="Pilih Tahun"
      className={className}
      placeholder="Tahun"
      value={String(value)}
      onChange={(key) => onChange(Number(key) || currentYear)}
    >
      <Label>Tahun</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {years.map((year) => (
            <ListBox.Item key={year} id={String(year)} textValue={String(year)}>
              <ListBox.ItemIndicator />
              {year}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
