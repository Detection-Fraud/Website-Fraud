import { TableColumn } from "@/components/layout/DataTable";
import { useFormatDate } from "@/hooks/useFormatDate";
import { ActivityReportItem } from "@/types/report.types";
import { Avatar, Button, Chip } from "@heroui/react";
import { FaEye } from "react-icons/fa";
import { FiCalendar, FiMapPin } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";

export const REPORT_COLUMNS: TableColumn[] = [
  { key: "activityName", label: "Nama Kegiatan" },
  { key: "lokasi", label: "Lokasi" },
  { key: "unit", label: "Unit" },
  { key: "picKegiatan", label: "PIC" },
  { key: "program", label: "Program" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Tanggal Dibuat" },
  { key: "aksi", label: "Aksi" },
];

export const renderReportCell = (
  item: ActivityReportItem,
  columnKey: string,
  onView: (id: string) => void,
) => {
  switch (columnKey) {
    case "createdAt":
      const date = new Date(item.createdAt).toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return (
        <div className="flex flex-row items-center gap-2">
          <FiCalendar className="text-slate-500 w-3.5 h-3.5" />
          <span className="text-xs font-light text-slate-700 max-w-[200px] truncate">
            {date}
          </span>
        </div>
      );
    case "lokasi":
      return (
        <div className="flex flex-row items-center gap-2">
          <FiMapPin className="text-slate-500 w-3.5 h-3.5" />
          <span className="text-xs font-light text-slate-700 max-w-[200px] truncate">
            {item.lokasi}
          </span>
        </div>
      );
    case "unit":
      const getUnitType = () => {
        if (item.division) return "Divisi";
        if (item.branch) return "Kancab";
        if (item.region) return "Kanwil";
        return "Kanwil";
      };

      const unitType = getUnitType();
      const getUnitTypeLabel = () => {
        if (unitType === "Divisi") return item.division?.name;
        if (unitType === "Kancab") return item.branch?.name;
        if (unitType === "Kanwil") return item.region?.name;
      };
      return (
        <div className="flex flex-row items-center gap-2">
          <LuBuilding2 className="text-slate-500 w-3.5 h-3.5" />
          <span className="text-xs font-light text-slate-700 max-w-[200px] truncate">
            {getUnitTypeLabel()}
          </span>
        </div>
      );
    case "picKegiatan":
      return (
        <div className="flex flex-row items-center gap-2">
          <Avatar variant="soft" color="accent" size="sm">
            <Avatar.Fallback>
              {item.picKegiatan.charAt(0).toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
          <span className="text-xs font-light text-slate-700 max-w-[200px] truncate">
            {item.picKegiatan}
          </span>
        </div>
      );
    case "program":
      return (
        <div className="flex flex-row items-center gap-2">
          <span className="text-xs font-light text-slate-700 max-w-[200px] truncate">
            {item.program?.name || "-"}
          </span>
        </div>
      );
    case "status": {
      const color =
        item.status === "APPROVED"
          ? "success"
          : item.status === "PENDING"
            ? "warning"
            : "danger";
      return (
        <Chip variant="soft" size="sm" color={color} className="rounded-md">
          {item.status}
        </Chip>
      );
    }
    case "activityName": {
      return (
        <span className="font-semibold text-md text-gray-700 max-w-[200px] truncate">
          {item.activityName}
        </span>
      );
    }
    case "aksi":
      return (
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className={"rounded-full text-blue-800"}
          onPress={() => onView(item.id)}
        >
          <FaEye />
        </Button>
      );
    default:
      return (item as any)[columnKey];
  }
};
