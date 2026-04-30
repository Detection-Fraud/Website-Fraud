"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable, { TableColumn } from "@/components/layout/DataTable";
import { useReportList, type ActivityReportItem } from "@/hooks/useReportList";
import { Button, Card, Chip } from "@heroui/react";
import { FaEye } from "react-icons/fa";
import { FiAlertTriangle, FiImage } from "react-icons/fi";
import { BsCheck2Circle, BsXCircle } from "react-icons/bs";

export default function ApprovalView() {
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
    summary,
  } = useReportList();

  const columns: TableColumn[] = [
    { key: "activityName", label: "Nama Kegiatan" },
    { key: "tanggalKegiatan", label: "Tanggal Kegiatan" },
    { key: "lokasi", label: "Lokasi" },
    { key: "unit", label: "Unit" },
    { key: "picKegiatan", label: "PIC" },
    { key: "program", label: "Program" },
    { key: "status", label: "Status" },
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
      case "unit":
        if (item.region?.name) return `Kanwil ${item.region.name}`;
        if (item.branch?.name) return `Kancab ${item.branch.name}`;
        if (item.division?.name) return `Divisi ${item.division.name}`;
        return "-";
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
            onPress={() => router.push(`/admin/approval/${item.id}`)}
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
        title="Admin Approval"
        description="Daftar foto kegiatan yang telah diupload oleh Kanwil, Kancab, dan Divisi"
        showAddButton={false}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Card className="rounded-xl shadow-md border-gray-200">
            <Card.Header className="flex flex-row items-center gap-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FiImage className="w-5 h-5 text-blue-600" />
              </div>
              <Card.Title>
                <p className="text-xs text-gray-500">Total Upload</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary.total}
                </p>
              </Card.Title>
            </Card.Header>
          </Card>
        </div>
        <div>
          <Card className="rounded-xl shadow-md border-gray-200">
            <Card.Header className="flex flex-row items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <FiAlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <Card.Title>
                <p className="text-xs text-gray-500">Menunggu</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary.pending}
                </p>
              </Card.Title>
            </Card.Header>
          </Card>
        </div>
        <div>
          <Card className="rounded-xl shadow-md border-gray-200">
            <Card.Header className="flex flex-row items-center gap-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <BsCheck2Circle className="w-5 h-5 text-green-600" />
              </div>
              <Card.Title>
                <p className="text-xs text-gray-500">Disetujui</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary.approved}
                </p>
              </Card.Title>
            </Card.Header>
          </Card>
        </div>
        <div>
          <Card className="rounded-xl shadow-md border-gray-200">
            <Card.Header className="flex flex-row items-center gap-2">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <BsXCircle className="w-5 h-5 text-red-600" />
              </div>
              <Card.Title>
                <p className="text-xs text-gray-500">Ditolak</p>
                <p className="text-xl font-bold text-gray-900">
                  {summary.rejected}
                </p>
              </Card.Title>
            </Card.Header>
          </Card>
        </div>
      </div>

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
