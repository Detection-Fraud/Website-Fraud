import { TableColumn } from "@/components/layout/DataTable";
import { ActivityReportItem } from "@/types/report.types";
import { Button, Chip } from "@heroui/react";
import { FaEye } from "react-icons/fa";

export const REPORT_COLUMNS: TableColumn[] = [
  { key: "activityName", label: "Nama Kegiatan" },
  { key: "tanggalKegiatan", label: "Tanggal Kegiatan" },
  { key: "lokasi", label: "Lokasi" },
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
    case "tanggalKegiatan":
      return new Date(item.tanggalKegiatan).toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    case "createdAt":
      return new Date(item.createdAt).toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    case "program":
      return item.program?.name || "-";
    case "status": {
      const color =
        item.status === "APPROVED"
          ? "success"
          : item.status === "PENDING"
            ? "warning"
            : "danger";
      return (
        <Chip variant="soft" size="md" color={color} className="rounded-md">
          {item.status}
        </Chip>
      );
    }
    case "aksi":
      return (
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          className={"rounded-full"}
          onPress={() => onView(item.id)}
        >
          <FaEye />
        </Button>
      );
    default:
      return (item as any)[columnKey];
  }
};
