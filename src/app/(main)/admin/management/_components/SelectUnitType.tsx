import { Label, ListBox, Select } from "@heroui/react";
import { FiCheck, FiMapPin } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";
import { MdOutlineShield } from "react-icons/md";

interface UnitOption {
  id: string;
  name: string;
  subLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const UNIT_OPTIONS: UnitOption[] = [
  {
    id: "KANWIL",
    name: "Kantor Wilayah",
    subLabel: "(Regional)",
    description: "Kanwil (Regional)",
    icon: FiMapPin,
  },
  {
    id: "KANCAB",
    name: "Kantor Cabang",
    subLabel: "(Cabang)",
    description: "Kancab (Cabang)",
    icon: LuBuilding2,
  },
  {
    id: "DIVISI",
    name: "Divisi",
    subLabel: "(Divisi)",
    description: "Divisi",
    icon: MdOutlineShield,
  },
];

interface SelectUnitTypeProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}
export default function SelectUnitType({
  value,
  onChange,
  className,
}: SelectUnitTypeProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Select
        className={className}
        value={value}
        onChange={(key) => onChange(key as string)}
        aria-label="Pilih Jenis Unit Kerja"
      >
        <Label className="text-slate-500 text-xs font-medium pl-1">
          Pilih Jenis Unit Kerja
        </Label>

        <Select.Trigger
          className={
            "w-full min-h-[64px] px-4 py-2.5 rounded-2xl border border-slate-200 " +
            "shadow-sm hover:border-sky-300 hover:shadow-md hover:shadow-sky-50/50 " +
            "bg-white transition-all duration-200 flex items-center justify-between"
          }
        >
          <Select.Value>
            {({ defaultChildren, isPlaceholder, state }) => {
              if (isPlaceholder || state.selectedItems.length === 0) {
                return defaultChildren;
              }

              const selectedItems = state.selectedItems;

              if (selectedItems.length > 1) {
                return `${selectedItems.length} users selected`;
              }

              const selectedItem = UNIT_OPTIONS.find(
                (unit) => unit.id === selectedItems[0].key,
              );

              if (!selectedItem) {
                return defaultChildren;
              }

              return (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-linear-to-br from-sky-600 to-sky-500 text-white rounded-xl shadow-inner shrink-0">
                    <selectedItem.icon className={"w-5 h-5"} />
                  </div>

                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-slate-800 text-sm leading-tight">
                      {selectedItem.name}
                    </span>

                    <span className="text-xs text-slate-400 font-normal leading-normal mt-0.5">
                      {selectedItem.subLabel}
                    </span>
                  </div>
                </div>
              );
            }}
          </Select.Value>
          <Select.Indicator className="text-slate-400" />
        </Select.Trigger>

        <Select.Popover
          className={
            "w-full max-w-[288px] border border-slate-100 shadow-xl rounded-2xl overflow-hidden mt-1"
          }
        >
          <ListBox
            selectionMode="single"
            selectedKeys={value ? new Set([value]) : new Set()}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              if (selected) onChange(selected);
            }}
            className="p-1.5"
          >
            {UNIT_OPTIONS.map((unit) => (
              <ListBox.Item
                key={unit.id}
                id={unit.id}
                textValue={unit.name}
                className={
                  "flex items-center justify-between w-full p-2.5 rounded-xl cursor-pointer " +
                  "hover:bg-sky-50/70 focus:bg-sky-50/70 transition-all duration-150 " +
                  "data-[selected=true]:bg-sky-50/30"
                }
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-linear-to-br from-sky-600 to-sky-500  text-white rounded-xl shrink-0">
                      <unit.icon className={`w-5 h-5 `} />
                    </div>
                  </div>

                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-slate-800 text-sm leading-none">
                      {unit.name}
                    </span>

                    <span className="text-xs text-slate-400 font-normal mt-1 leading-none">
                      {unit.description}
                    </span>
                  </div>
                </div>

                <ListBox.ItemIndicator>
                  {({ isSelected }) => {
                    return isSelected ? (
                      <FiCheck className="size-5 text-sky-600" />
                    ) : null;
                  }}
                </ListBox.ItemIndicator>
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
