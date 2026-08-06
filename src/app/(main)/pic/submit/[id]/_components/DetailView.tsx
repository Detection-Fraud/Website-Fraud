"use client";

import ActivityTimeline from "@/components/reports/ActivityTimeline";
import { useReportDetail } from "@/hooks/useReportDetail";
import { formatDate } from "@/lib/formatDate";
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

export default function DetailView({ id }: { id: string }) {
  const { report, loading, user } = useReportDetail(id);

  const canResubmit =
    !!user?.unitId && !!report?.unit?.id && user.unitId === report.unit.id;

  const textRole = report?.unit
    ? `${report.unit.type === "DIVISI" ? "Divisi" : report.unit.type === "KANTOR_CABANG" ? "Kantor Cabang" : "Kantor Wilayah"} : ${report.unit.name}`
    : "Tidak Diketahui";

  const unitText = report?.unit?.name || "Memuat...";

  if (loading) {
    return (
      <div className="w-full space-y-6 mb-10 animate-pulse">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-10 w-3/4 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 mb-10">
      <div className="space-y-3">
        {/* UPDATED: text-slate-500 */}
        <Link
          href={`/pic/halaman-utama`}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2 text-sm font-medium"
        >
          <FiArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dashboard</span>
        </Link>
        {/* UPDATED: text-slate-900 */}
        <h2 className="text-2xl font-bold text-slate-900 leading-tight">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT MAIN CONTENT (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* UPDATED: Card Surface Upgrade (rounded-2xl border-slate-200/60 shadow-[var(--surface-shadow)]) */}
          <Card className="rounded-2xl p-5 border border-slate-200/60 shadow-surface hover:shadow-(--surface-shadow-md) transition-all duration-200 bg-white">
            <Card.Header className="pb-3 border-b border-slate-100 mb-4">
              <Card.Title>
                {/* UPDATED: text-slate-900 */}
                <p className="font-bold text-slate-900 text-base">
                  Informasi Kegiatan
                </p>
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* UPDATED: bg-slate-50 border border-slate-100 */}
                <div className="bg-slate-50 border border-slate-100/80 p-3.5 rounded-xl">
                  <div className="flex flex-row items-center gap-2 text-slate-500 shrink-0 mb-1">
                    <LuBuilding2 className="text-slate-500 w-3.5 h-3.5" />
                    <p className="text-xs font-medium text-slate-500">
                      Unit Kerja
                    </p>
                  </div>
                  <p className="font-semibold text-sm text-slate-800">
                    {unitText}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100/80 p-3.5 rounded-xl">
                  <div className="flex flex-row items-center gap-2 text-slate-500 shrink-0 mb-1">
                    <FiCalendar className="text-slate-500 w-3.5 h-3.5" />
                    <p className="text-xs font-medium text-slate-500">
                      Tanggal Kegiatan
                    </p>
                  </div>
                  <p className="font-semibold text-sm text-slate-800">
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

                <div className="bg-slate-50 border border-slate-100/80 p-3.5 rounded-xl">
                  <div className="flex flex-row items-center gap-2 text-slate-500 shrink-0 mb-1">
                    <FiMapPin className="text-slate-500 w-3.5 h-3.5" />
                    <p className="text-xs font-medium text-slate-500">Lokasi</p>
                  </div>
                  <p className="font-semibold text-sm text-slate-800">
                    {report?.lokasi}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100/80 p-3.5 rounded-xl">
                  <div className="flex flex-row items-center gap-2 text-slate-500 shrink-0 mb-1">
                    <FiUser className="text-slate-500 w-3.5 h-3.5" />
                    <p className="text-xs font-medium text-slate-500">
                      PIC Pelapor
                    </p>
                  </div>
                  <p className="font-semibold text-sm text-slate-800">
                    {report?.createdBy?.name || "-"}
                  </p>
                </div>
              </div>

              {/* UPDATED: Program Budaya Banner */}
              <div className="bg-sky-50 border border-sky-100 p-3.5 rounded-xl w-full">
                <p className="text-xs text-sky-600 font-medium">
                  Program Budaya
                </p>
                <p className="text-base font-bold text-sky-900 mt-0.5">
                  {report?.program?.name}
                </p>
              </div>

              <div className="space-y-1 pt-1">
                <p className="text-sm font-semibold text-slate-800">
                  Deskripsi Kegiatan
                </p>
                {/* UPDATED: text-slate-600 */}
                <p className="text-sm text-slate-600 leading-relaxed">
                  {report?.description}
                </p>
              </div>
            </Card.Content>
          </Card>

          {/* UPDATED: Photo Gallery Card Surface Upgrade */}
          <Card className="rounded-2xl p-5 border border-slate-200/60 shadow-surface hover:shadow-(--surface-shadow-md) transition-all duration-200 bg-white">
            <Card.Header className="pb-3 border-b border-slate-100 mb-4">
              <Card.Title>
                <div className="flex flex-row items-center gap-2">
                  <FiImage className="text-blue-600 w-5 h-5" />
                  {/* UPDATED: text-slate-900 */}
                  <p className="text-slate-900 font-bold text-base">
                    Dokumentasi Foto Kegiatan
                  </p>
                  <Chip
                    size="sm"
                    color="default"
                    variant="soft"
                    className="text-xs font-bold tabular-nums"
                  >
                    <Chip.Label>{report?.photos?.length || 0}</Chip.Label>
                  </Chip>
                </div>
              </Card.Title>
            </Card.Header>
            <Card.Content>
              {report?.photos && report.photos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {report.photos.map((photo: any, index: number) => {
                    const imgSrc = photo.imageUrl || (photo as any).url;
                    if (!imgSrc) return null;
                    return (
                      <div
                        key={photo.id || index}
                        className="relative h-44 rounded-xl overflow-hidden border border-slate-200 group shadow-xs"
                      >
                        <Image
                          src={imgSrc}
                          alt={`Dokumentasi ${index + 1}`}
                          fill
                          unoptimized={!imgSrc.startsWith("http")}
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-10 text-slate-400 text-sm font-medium">
                  Tidak ada foto dokumentasi
                </div>
              )}
            </Card.Content>
          </Card>
        </div>

        {/* RIGHT SIDEBAR (1 Col): Activity Timeline */}
        <div className="lg:col-span-1 space-y-5 sticky top-6">
          <ActivityTimeline logs={report?.logs || []} />
        </div>
      </div>
    </div>
  );
}
