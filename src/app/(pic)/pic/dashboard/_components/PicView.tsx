"use client";

import { Button, Chip } from "@heroui/react";
import { FaEye } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable, { TableColumn } from "@/components/layout/DataTable";
import AppBar from "@/components/layout/Appbar";

export interface ActivityReportItem {
  id: string;
  activityName: string;
  tanggalKegiatan: string;
  lokasi: string;
  picKegiatan: string;
  description: string;
  status: string;
  createdAt: string;
  notes?: string | null;
  region?: { name: string } | null;
  branch?: { name: string } | null;
  division?: { name: string } | null;
  program?: { name: string } | null;
  photos?: { id: number; originalName: string; imageUrl: string }[];
}

export default function PicView() {
  const [reports, setReports] = useState<ActivityReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch("/api/reports");
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.message || "Gagal mengambil data laporan");
        }
        setReports(json.data || []);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
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

      <DataTable column={columns} renderCell={renderCell} data={reports} />
    </div>
  );
}
