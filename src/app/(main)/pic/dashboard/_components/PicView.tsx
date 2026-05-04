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

import { useSearchParams } from "next/navigation";
import { Select, ListBox } from "@heroui/react";

import { useEffect, useState } from "react";
import { ProgramBudaya } from "@generated/prisma";

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

  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") || "ALL";
  const currentProgram = searchParams.get("programId") || "ALL";

  const [programs, setPrograms] = useState<ProgramBudaya[]>([]);

  useEffect(() => {
    fetch("/api/programs")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setPrograms(json.data);
      })
      .catch((err) => console.error(err));
  }, []);

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
        filterStatus={
          <div className="w-48">
            <Select
              aria-label="Filter Status"
              placeholder="Semua Status"
              value={currentStatus}
              onChange={(key) => {
                const selected = key as string;
                updateParams({ status: selected, page: "1" });
              }}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="ALL" textValue="Semua Status">
                    <ListBox.ItemIndicator />
                    Semua Status
                  </ListBox.Item>
                  <ListBox.Item id="PENDING" textValue="Pending">
                    <ListBox.ItemIndicator />
                    Pending
                  </ListBox.Item>
                  <ListBox.Item id="APPROVED" textValue="Approved">
                    <ListBox.ItemIndicator />
                    Approved
                  </ListBox.Item>
                  <ListBox.Item id="REJECTED" textValue="Rejected">
                    <ListBox.ItemIndicator />
                    Rejected
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        }
        filterProgram={
          <div className="w-48">
            <Select
              aria-label="Filter Program"
              placeholder="Semua Program"
              value={currentProgram}
              onChange={(key) => {
                const selected = key as string;
                updateParams({ programId: selected, page: "1" });
              }}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="ALL" textValue="Semua Status">
                    <ListBox.ItemIndicator />
                    Semua Program
                  </ListBox.Item>
                  {programs.map((program) => (
                    <ListBox.Item
                      key={program.id}
                      id={program.id}
                      textValue={program.name}
                    >
                      <ListBox.ItemIndicator />
                      {program.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        }
      />
    </div>
  );
}
