"use client";

import {
  Button,
  Chip,
  Label,
  SearchField,
  SearchFieldGroup,
} from "@heroui/react";
import { FaEye } from "react-icons/fa";
import DataTable, { TableColumn } from "@/components/layout/DataTable";
import AppBar from "@/components/layout/Appbar";
import { useReportList, type ActivityReportItem } from "@/hooks/useReportList";

export default function PicView() {
  const {
    reports,
    pagination,
    isLoading,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    updateParams,
    router,
  } = useReportList();

  const columns: TableColumn[] = [
    { key: "activityName", label: "Nama Kegiatan" },
    { key: "tanggalKegiatan", label: "Tanggal Kegiatan" },
    { key: "lokasi", label: "Lokasi" },
    { key: "picKegiatan", label: "PIC" },
    { key: "program", label: "Program" },
    { key: "status", label: "Status" },
    { key: "createdAt", label: "Tanggal Dibuat" },
    { key: "aksi", label: "Aksi" },
  ];

  const renderCell = (item: ActivityReportItem, columnKey: string) => {
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
            onPress={() => router.push(`/pic/detection/${item.id}`)}
          >
            <FaEye />
          </Button>
        );
      default:
        return (item as any)[columnKey];
    }
  };

  return (
    <div className="space-y-8 mb-10">
      <AppBar
        onAdd={() => {
          router.push("/pic/detection");
        }}
      />

      <DataTable
        column={columns}
        renderCell={renderCell}
        data={reports}
        pagination={pagination}
        onPageChange={(page) => updateParams({ page: String(page) })}
        search={searchInput}
        onSearch={setSearchInput}
        onClearSearch={handleClearSearch}
        handleSearch={handleSearch}
      />
    </div>
  );
}
