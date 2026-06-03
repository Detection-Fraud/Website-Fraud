"use client";

import { formatDate } from "@/lib/formatDate";
import { useReportDetail } from "@/hooks/useReportDetail";
import { StatusType } from "@/types/status.types";
import { Card, Chip, Skeleton } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import {
  FiArrowLeft,
  FiCalendar,
  FiImage,
  FiMapPin,
  FiUser,
} from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";
import StatusView from "./StatusView";
import ActivityTimeline from "@/components/reports/ActivityTimeline";

export default function DetailView({ id }: { id: string }) {
  const { report, loading, user } = useReportDetail(id);

  // PIC bisa resubmit jika laporan milik unit mereka sendiri
  // Cek ketiga kemungkinan: Kancab, Kanwil, atau Divisi
  const canResubmit =
    !!user?.unitId && !!report?.unit?.id && user.unitId === report.unit.id;

  const textRole = report?.unit
    ? `${report.unit.type === "DIVISI" ? "Divisi" : report.unit.type === "KANTOR_CABANG" ? "Kantor Cabang" : "Kantor Wilayah"} : ${report.unit.name}`
    : "Tidak Diketahui";

  const unitText = report?.unit?.name || "Memuat...";

  if (loading) {
    return (
      <div className="w-full space-y-6 mb-10 animate-pulse">
        {/* Tombol Back & Judul */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-10 w-3/4 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        {/* Status View */}
        <Skeleton className="h-24 w-full rounded-xl" />
        {/* Grid Konten Bawah */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar */}
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          {/* Galeri Foto */}
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 mb-10">
      <div className="space-y-2">
        <Link
          href={`/pic/dashboard`}
          className="flex items-center gap-2 text-gray-500 hover:underline mb-4"
        >
          <FiArrowLeft className="w-5 h-5" />
          <span className="font-medium">Kembali ke Dashboard</span>
        </Link>
        <h2 className="text-2xl font-bold text-gray-900 leading-tight">
          {report?.activityName}
        </h2>
        <Chip color="accent" variant="soft">
          <LuBuilding2 />
          <Chip.Label>{textRole}</Chip.Label>
        </Chip>
      </div>

      <div>
        <StatusView
          status={report?.status as StatusType}
          sentDate={formatDate(report?.createdAt)}
          note={report?.notes || ""}
          updatedAt={formatDate(report?.updatedAt)}
          reportId={report?.id ?? ""}
          canResubmit={canResubmit}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT MAIN CONTENT */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="rounded-2xl p-5 border border-gray-200 shadow-sm">
            <Card.Header>
              <Card.Title>
                <p className="font-bold">Informasi Kegiatan</p>
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#f8fafc] p-[14px] rounded-lg">
                  <div className="flex flex-row items-center gap-2 text-gray-500 shrink-0">
                    <LuBuilding2 className="text-slate-500 w-3.5 h-3.5" />
                    <p className="text-xs">Unit Kerja</p>
                  </div>
                  <p className="font-semibold text-md text-[#314158]">
                    {unitText}
                  </p>
                </div>

                <div className="bg-[#f8fafc] p-[14px] rounded-lg">
                  <div className="flex flex-row items-center gap-2 text-gray-500 shrink-0">
                    <FiCalendar className="text-slate-500 w-3.5 h-3.5" />
                    <p className="text-xs">Tanggal Kegiatan</p>
                  </div>
                  <p className="font-semibold text-md text-[#314158]">
                    {typeof report?.tanggalKegiatan === "string"
                      ? new Date(report?.tanggalKegiatan).toLocaleDateString(
                          "id-ID",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )
                      : report?.tanggalKegiatan?.toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                  </p>
                </div>

                <div className="bg-[#f8fafc] p-[14px] rounded-lg">
                  <div className="flex flex-row items-center gap-2 text-gray-500 shrink-0">
                    <FiMapPin className="text-slate-500 w-3.5 h-3.5" />
                    <p className="text-xs">Lokasi</p>
                  </div>
                  <p className="font-semibold text-md text-[#314158]">
                    {report?.lokasi}
                  </p>
                </div>
                <div className="bg-[#f8fafc] p-[14px] rounded-lg">
                  <div className="flex flex-row items-center gap-2 text-gray-500 shrink-0">
                    <FiUser className="text-slate-500 w-3.5 h-3.5" />
                    <p className="text-xs">PIC Pelapor</p>
                  </div>
                  <p className="font-semibold text-md text-[#314158]">
                    {report?.picKegiatan}
                  </p>
                </div>
              </div>

              <div className="bg-[#e0f2fe] p-[14px] rounded-2xl w-full">
                <p className="text-[#0ea5e9]">Program Budaya</p>
                <p className="text-md font-semibold text-[#0369a1]">
                  {report?.program?.name}
                </p>
              </div>

              <div className="space-y-1 px-[10px]">
                <p className="text-md font-semibold text-[#62748e]">
                  Deskripsi Kegiatan
                </p>
                <p className="text-sm text-gray-400">{report?.description}</p>
              </div>
            </Card.Content>
          </Card>

          <Card className="rounded-2xl p-5 border border-gray-200 shadow-sm">
            <Card.Header>
              <Card.Title>
                <div className="flex flex-row items-center gap-2">
                  <FiImage className="text-blue-600 w-5 h-5" />
                  <p className="text-gray-900 font-semibold">
                    Dokumentasi Foto Kegiatan
                  </p>
                  <Chip>
                    <Chip.Label>{report?.photos?.length || 0}</Chip.Label>
                  </Chip>
                </div>
              </Card.Title>
            </Card.Header>
            <Card.Content className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {report?.photos?.map((photos, idx) => (
                <div
                  key={idx}
                  className="relative w-full h-40 overflow-hidden rounded-xl group cursor-pointer"
                >
                  <Image
                    src={photos.imageUrl}
                    alt={`Foto ${idx + 1}`}
                    width={500}
                    height={500}
                    unoptimized={!photos.imageUrl.startsWith("http")}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </Card.Content>
          </Card>
        </div>

        {/* RIGHT SIDEBAR - ACTIVITY TIMELINE */}
        <div className="lg:col-span-1 space-y-4">
          <ActivityTimeline logs={report?.logs} />
        </div>
      </div>
    </div>
  );
}
