"use client";

import { useFormatDate } from "@/hooks/useFormatDate";
import { useReportDetail } from "@/hooks/useReportDetail";
import { StatusType } from "@/types/status.types";
import { Card, Chip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import {
  FiArrowLeft,
  FiCalendar,
  FiImage,
  FiMapPin
} from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";
import StatusView from "./StatusView";

export default function DetailView({ id }: { id: string }) {
  const { report, loading, user } = useReportDetail(id);

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
          <Chip.Label>
            {report?.region?.name && `Kantor Wilayah: ${report.region.name}`}
            {report?.branch?.name && `Kantor Cabang: ${report.branch.name}`}
            {report?.division?.name && `Divisi: ${report.division.name}`}
          </Chip.Label>
        </Chip>
      </div>

      <div>
        <StatusView
          status={report?.status as StatusType}
          sentDate={useFormatDate(report?.createdAt)}
          note={report?.notes || ""}
          updatedAt={useFormatDate(report?.updatedAt)}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT SIDEBAR */}
        <div className="space-y-5">
          <Card className="rounded-2xl p-5 border border-gray-200 shadow-sm">
            <Card.Header>
              <Card.Title>
                <div className="flex flex-row items-center gap-2 text-gray-500 mb-4 ">
                  <LuBuilding2 className="w-5 h-5" />
                  <p className="font-semibold tracking-wide text-sm uppercase">
                    Informasi Unit
                  </p>
                </div>
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Unit : </p>
                <Chip color="accent" variant="soft" size="lg">
                  {report?.region?.name && `Kantor Wilayah`}
                  {report?.branch?.name && `Kantor Cabang`}
                  {report?.division?.name && `Divisi`}
                </Chip>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Nama Unit : </p>
                <Chip variant="secondary" size="lg">
                  {report?.region?.name && `${report.region.name}`}
                  {report?.branch?.name && `${report.branch.name}`}
                  {report?.division?.name && `${report.division.name}`}
                </Chip>
              </div>
              <div className="flex items-start gap-2">
                <FiMapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <p className="text-sm text-gray-600">{report?.lokasi}</p>
              </div>
            </Card.Content>
          </Card>
          <Card className="rounded-2xl p-5 border border-gray-200 shadow-sm">
            <Card.Header>
              <Card.Title>
                <div className="flex flex-row items-center gap-2 text-gray-500 mb-4 ">
                  <FiCalendar className="w-5 h-5" />
                  <p className="font-semibold tracking-wide text-sm uppercase">
                    Waktu
                  </p>
                </div>
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Unit : </p>
                <p className="text-sm font-semibold text-gray-800">
                  {useFormatDate(report?.createdAt)}
                </p>
              </div>
              {report?.updatedAt && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Direview Pada : </p>
                  <p className="text-sm font-semibold text-gray-800">
                    {useFormatDate(report?.updatedAt)}
                  </p>
                </div>
              )}
            </Card.Content>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="rounded-2xl p-5 border border-gray-200 shadow-sm">
            <Card.Header>
              <Card.Title>
                <div className="flex flex-row items-center gap-2">
                  <FiImage className="text-blue-600 w-5 h-5" />
                  <p className="text-gray-900 font-semibold">
                    Dokumentasi Foto Kegiatan
                  </p>
                  <Chip>
                    <Chip.Label>{report?.photos?.length}</Chip.Label>
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
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
