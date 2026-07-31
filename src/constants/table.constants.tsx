import { TableColumn } from "@/components/layout/DataTable";
import { ActivityReportItem } from "@/types/report.types";
import { Avatar, Button, Chip } from "@heroui/react";
import { FaEye } from "react-icons/fa";
import { FiCalendar, FiMapPin } from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";

export const REPORT_COLUMNS: TableColumn[] = [
  { key: "activityName", label: "Nama Kegiatan" },
  { key: "lokasi", label: "Lokasi" },
  { key: "unit", label: "Unit" },
  { key: "createdBy", label: "PIC" },
  { key: "programCategory", label: "Kategori Program" },
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
      const getUnitTypeLabel = () => {
        if (!item.unit) return "-";
        return item.unit.name;
      };
      return (
        <div className="flex flex-row items-center gap-2">
          <LuBuilding2 className="text-slate-500 w-3.5 h-3.5" />
          <span className="text-xs font-light text-slate-700 max-w-[200px] truncate">
            {getUnitTypeLabel()}
          </span>
        </div>
      );
    case "createdBy":
      return (
        <div className="flex flex-row items-center gap-2">
          <Avatar variant="soft" color="accent" size="sm">
            <Avatar.Fallback>
              {item.createdBy?.name.charAt(0).toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
          <span className="text-xs font-light text-slate-700 max-w-[200px] truncate">
            {item.createdBy?.name}
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
    case "programCategory": {
      const category = item.program?.category;
      return (
        <div className="flex flex-col items-start gap-1">
          {category ? (
            <Chip
              size="sm"
              variant="soft"
              className="w-fit"
              style={
                category.color
                  ? {
                      backgroundColor: `${category.color}20`,
                      color: category.color,
                    }
                  : undefined
              }
            >
              <Chip.Label>{category.name}</Chip.Label>
            </Chip>
          ) : (
            <span className="text-xs font-light text-slate-500">-</span>
          )}
        </div>
      );
    }

    case "status": {
      const color =
        item.status === "APPROVED"
          ? "success"
          : item.status === "PENDING"
            ? "warning"
            : "danger";
      return (
        <Chip
          variant="soft"
          size="sm"
          color={color}
          className="rounded-md w-fit"
        >
          <Chip.Label>{item.status}</Chip.Label>
        </Chip>
      );
    }
    case "activityName": {
      return (
        <span className="font-semibold text-md text-gray-700 max-w-50 truncate">
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
