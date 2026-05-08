"use client";

import AppBar from "@/components/layout/Appbar";
import DataTable, { TableColumn } from "@/components/layout/DataTable";
import { useReportList } from "@/hooks/useReportList";
import {
  Avatar,
  Button,
  Card,
  Chip,
  SearchField,
  SearchFieldGroup,
  Tag,
  TagGroup,
} from "@heroui/react";
import { FaEye } from "react-icons/fa";
import { FiAlertTriangle, FiCalendar, FiImage, FiMapPin } from "react-icons/fi";
import { BsCheck2Circle, BsXCircle } from "react-icons/bs";
import { ActivityReportItem } from "@/types/report.types";
import { LuBuilding2 } from "react-icons/lu";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";

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
    statusFilter,
    summary,
  } = useReportList();

  const { charts } = useDashboardAnalytics();

  const columns: TableColumn[] = [
    { key: "activityName", label: "Nama Kegiatan" },
    { key: "tanggalKegiatan", label: "Tanggal" },
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
        const date = new Date(item.tanggalKegiatan).toLocaleDateString(
          "id-ID",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          },
        );
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
        const unitName = item.region?.name
          ? `Kanwil ${item.region.name}`
          : item.branch?.name
            ? `Kancab ${item.branch.name}`
            : item.division?.name
              ? `Divisi ${item.division.name}`
              : "-";
        return (
          <div className="flex flex-row items-center gap-2">
            <LuBuilding2 className="text-slate-500 w-3.5 h-3.5" />
            <span className="text-xs font-light text-slate-700 max-w-[200px] truncate">
              {unitName}
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
          <Card className="rounded-xl shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <Card.Header className="flex flex-row items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiImage className="w-5 h-5 text-blue-600" />
              </div>
              <Card.Title>
                <p className="text-3xl font-bold leading-none text-[#0284c7]">
                  {summary.total}
                </p>
                <p className="text-sm text-slate-700 font-semibold">
                  Total Upload
                </p>
                <p className="text-slate-400 text-xs mt-0.5">Semua Unggahan</p>
              </Card.Title>
            </Card.Header>
          </Card>
        </div>
        <div>
          <Card className="rounded-xl shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <Card.Header className="flex flex-row items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <FiAlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <Card.Title>
                <p className="text-3xl font-bold text-[#d97706] leading-none">
                  {summary.pending}
                </p>
                <p className="text-sm text-slate-700 font-semibold">Menunggu</p>
                <p className="text-xs text-slate-400 mt-0.5">Total Menunggu</p>
              </Card.Title>
            </Card.Header>
          </Card>
        </div>
        <div>
          <Card className="rounded-xl shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <Card.Header className="flex flex-row items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <BsCheck2Circle className="w-5 h-5 text-green-600" />
              </div>
              <Card.Title>
                <p className="text-3xl font-bold text-[#059669] leading-none">
                  {summary.approved}
                </p>
                <p className="text-sm text-slate-700 font-semibold">
                  Disetujui
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Total Disetujui</p>
              </Card.Title>
            </Card.Header>
          </Card>
        </div>
        <div>
          <Card className="rounded-xl shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <Card.Header className="flex flex-row items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <BsXCircle className="w-5 h-5 text-red-600" />
              </div>
              <Card.Title>
                <p className="text-3xl font-bold text-[#ef4444] leading-none">
                  {summary.rejected}
                </p>
                <p className="text-sm text-slate-700 font-semibold">Ditolak</p>
                <p className="text-xs text-slate-400 mt-0.5">Total Ditolak</p>
              </Card.Title>
            </Card.Header>
          </Card>
        </div>
      </div>

      <Card className="rounded-lg shadow-md border-gray-200 p-0">
        <div className="flex flex-row w-full items-center justify-between pr-4">
          <Card.Header className="p-4">
            <Card.Title className="font-semibold text-md">
              Daftar Laporan
            </Card.Title>
            <Card.Description className="text-xs text-gray-500">
              {summary.total} data
            </Card.Description>
          </Card.Header>

          <div className="flex flex-row  items-center justify-center gap-6">
            {/* 1. Search  */}
            <div>
              <SearchField>
                <SearchFieldGroup className={"shadow-sm bg-[#f8fafc]"}>
                  <SearchField.SearchIcon />
                  <SearchField.Input
                    placeholder="Search..."
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch?.();
                      }
                    }}
                  />
                  <SearchField.ClearButton
                    onClick={() => handleClearSearch?.()}
                  />
                </SearchFieldGroup>
              </SearchField>
            </div>
            {/* FILTER */}
            <div>
              <TagGroup
                selectedKeys={new Set([statusFilter])}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  updateParams({ status: selected, page: "1" });
                }}
                aria-label="Filter"
                selectionMode="single"
              >
                <TagGroup.List>
                  <Tag
                    id="ALL"
                    className="data-[selected=true]:bg-linear-to-br data-[selected=true]:from-sky-600 data-[selected=true]:to-sky-500 data-[selected=true]:text-white data-[selected=true]:font-semibold data-[selected=true]:shadow-md px-3 py-1"
                  >
                    Semua
                  </Tag>
                  <Tag
                    id="PENDING"
                    className="data-[selected=true]:bg-linear-to-br data-[selected=true]:from-amber-600 data-[selected=true]:to-amber-400 data-[selected=true]:text-white data-[selected=true]:font-semibold data-[selected=true]:shadow-md px-3 py-1"
                  >
                    Pending
                  </Tag>
                  <Tag
                    id="APPROVED"
                    className="data-[selected=true]:bg-linear-to-br data-[selected=true]:from-green-600 data-[selected=true]:to-green-500 data-[selected=true]:text-white data-[selected=true]:font-semibold data-[selected=true]:shadow-md px-3 py-1"
                  >
                    Approved
                  </Tag>
                  <Tag
                    id="REJECTED"
                    className="data-[selected=true]:bg-gradient-to-br data-[selected=true]:from-red-600 data-[selected=true]:to-red-400 data-[selected=true]:text-white data-[selected=true]:font-semibold data-[selected=true]:shadow-md px-3 py-1"
                  >
                    Rejected
                  </Tag>
                </TagGroup.List>
              </TagGroup>
            </div>
          </div>
        </div>
        <DataTable
          column={columns}
          renderCell={renderCell}
          data={reports}
          pagination={pagination}
          onPageChange={(page) => updateParams({ page: String(page) })}
        />
      </Card>
    </div>
  );
}
