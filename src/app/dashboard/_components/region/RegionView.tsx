"use client";

import { Button, Chip } from "@heroui/react";
import { FaEye } from "react-icons/fa";
import AppBar from "../AppBar";
import DataTable, { TableColumn } from "../DataTable";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export interface ActivityReportItem {
  id: string;
  activityName: string;
  quarterPeriod: string;
  year: string;
  claimedCount: number;
  createdAt: string;
  user?: { name: string };
  branch?: { name: string };
  status?: string;
}
export default function RegionView() {
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
    { key: "activityName", label: "Nama Aktivitas" },
    { key: "quarterPeriod", label: "Periode" },
    { key: "year", label: "Tahun" },
    { key: "claimedCount", label: "Jumlah Kegiatan" },
    { key: "status", label: "Status" },
    { key: "createdAt", label: "Tanggal Dibuat" },
    { key: "aksi", label: "Aksi" },
  ];

  const renderCell = (item: ActivityReportItem, columnKey: string) => {
    switch (columnKey) {
      case "createdAt":
        return new Date(item.createdAt).toLocaleDateString("id-ID", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      case "claimedCount":
        return (
          <Chip variant="soft" size="md" color="success" className="rounded-md">
            {`${item.claimedCount} `}
          </Chip>
        );
      case "status":
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
      case "aksi":
        return (
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            className={"rounded-full"}
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
          router.push("/dashboard/detection");
        }}
      />

      <DataTable column={columns} renderCell={renderCell} data={reports} />
    </div>
  );
}
