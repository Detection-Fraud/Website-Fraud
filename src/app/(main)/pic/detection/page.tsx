"use client";

import { useReportStore } from "@/store/useReportStore";
import { Card, Link } from "@heroui/react";
import { useEffect } from "react";

import { CiImageOn } from "react-icons/ci";

import { useProgramList } from "@/hooks/useProgramList";
import Dropzone from "./_components/dropzone";
import FormDetection from "./_components/form-detection";
import GridPreview from "./_components/gridPreview";

export default function DetectionPage() {
  const { resetStore } = useReportStore();
  const { programs } = useProgramList();

  useEffect(() => {
    return () => resetStore();
  }, [resetStore]);

  return (
    <div className="w-full space-y-6">
      {/* HEADER HALAMAN */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-4">
          <Link href="/pic/dashboard" className="text-sm font-semibold">
            &larr; Kembali ke Dashboard
          </Link>
        </div>
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-gray-900">
            Upload Foto Kegiatan
          </h3>
          <p className="text-gray-600 text-sm">
            Sistem dilengkapi dengan AI Pendeteksi Duplikat (Fraud). Upload
            maksimal 10 foto dokumentasi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 w-full max-w-5xl mx-auto gap-4 lg:gap-6 px-4 items-start">
        {/* KOLOM KIRI (Besar): DROPZONE & PREVIEW */}
        <Card className="w-full p-6 lg:col-span-2 shadow-sm" variant="default">
          <Card.Content>
            <h2 className="text-lg mb-4 font-semibold text-gray-800">
              Bukti Foto Kegiatan
            </h2>
            <Dropzone />
            <GridPreview />
          </Card.Content>
        </Card>

        {/* KOLOM KANAN (Kecil): FORM TEKS & TOMBOL */}
        <div className="lg:col-span-1 flex flex-col gap-6 sticky top-6 mb-10">
          <FormDetection
            programs={programs}
          />

          <Card className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex flex-row items-center justify-start gap-2">
              <div>
                <CiImageOn className="text-lg text-blue-600" />
              </div>
              <Card.Header>
                <Card.Title className="text-sm font-medium text-blue-900">
                  Catatan Penting :{" "}
                </Card.Title>
              </Card.Header>
            </div>
            <Card.Content className="px-6">
              <ul className="space-y-2 text-sm text-blue-800 list-disc">
                <li>Maksimal 10 foto per upload</li>
                <li>Foto akan dicek otomatis oleh AI</li>
                <li>Foto fraud harus dihapus/diganti</li>
                <li>Boleh upload lebih sedikit dari jumlah kegiatan</li>
              </ul>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
