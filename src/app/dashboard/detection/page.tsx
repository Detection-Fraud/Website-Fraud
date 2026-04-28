"use client";

import {
  ReportFormData,
  useReportSubmission,
} from "@/hooks/useReportSubmission";
import { useReportStore } from "@/store/useReportStore";
import {
  Button,
  Card,
  Form,
  Input,
  Label,
  Link,
  TextField,
} from "@heroui/react";
import { useEffect } from "react";

import { CiImageOn } from "react-icons/ci";

import Dropzone from "./_components/dropzone";
import GridPreview from "./_components/gridPreview";

export default function DetectionPage() {
  const { resetStore } = useReportStore();

  const {
    loadingText,
    handleCheckFraud,
    tanganiSubmitFinal,
    adaGambarIdle,
    adaGambarFraud,
    adaGambarLoading,
    semuaLulus,
    totalGambar,
  } = useReportSubmission();

  // Bersihkan memori gambar saat keluar dari halaman
  useEffect(() => {
    return () => resetStore();
  }, [resetStore]);

  return (
    <div className="w-full space-y-6">
      {/* HEADER HALAMAN */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-4">
          <Link href="/dashboard" className="text-sm font-semibold">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 w-full max-w-5xl mx-auto gap-6 px-4">
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
        <div className="lg:col-span-1">
          <Card variant="default" className="shadow-sm">
            <Card.Header className="pt-5">
              <Card.Title className="font-semibold text-gray-900 text-lg">
                Informasi Laporan
              </Card.Title>
            </Card.Header>

            <Card.Content className="pt-2 pb-5">
              {/* Komponen Form HeroUI membungkus input dan tombol submit */}
              <Form
                validationBehavior="native"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = Object.fromEntries(
                    new FormData(e.currentTarget),
                  ) as unknown as ReportFormData;
                  tanganiSubmitFinal(formData);
                }}
                className="w-full flex flex-col gap-5"
              >
                <TextField name="activityName" isRequired className="w-full">
                  <Label className="text-sm font-medium">Nama Kegiatan</Label>
                  <Input
                    placeholder="Contoh: Sosialisasi Bulog"
                    className="mt-1"
                    autoComplete="off"
                  />
                </TextField>
                <TextField name="claimedCount" isRequired className="w-full">
                  <Label className="text-sm font-medium">Total Kegiatan</Label>
                  <Input
                    placeholder="Contoh: 1"
                    type="number"
                    className="mt-1"
                    autoComplete="off"
                  />
                </TextField>

                <TextField name="year" isRequired className="w-full">
                  <Label className="text-sm font-medium">Tahun Kegiatan</Label>
                  <Input
                    placeholder="2026"
                    type="number"
                    autoComplete="off"
                    className="mt-1"
                  />
                </TextField>

                <TextField name="quarterPeriod" isRequired className="w-full">
                  <Label className="text-sm font-medium">
                    Periode Triwulan
                  </Label>
                  <Input
                    placeholder="Contoh: Q1"
                    type="text"
                    autoComplete="off"
                    className="mt-1"
                  />
                </TextField>

                {/* Teks Animasi Loading */}
                {loadingText && (
                  <p className="text-xs font-semibold text-blue-600 animate-pulse text-center mt-2 bg-blue-50 py-2 rounded-lg">
                    ⏳ {loadingText}
                  </p>
                )}

                {/* AREA TOMBOL */}
                <div className="mt-2 grid grid-cols-2 gap-3 w-full">
                  {/* Tombol Check AI */}
                  <Button
                    type="button" // Mencegah form ke-submit
                    onPress={handleCheckFraud} // Pakai onPress untuk NextUI/HeroUI
                    variant="primary"
                    isDisabled={
                      !adaGambarIdle || adaGambarLoading || totalGambar === 0
                    }
                    className="w-full font-semibold"
                  >
                    Cek AI
                  </Button>

                  {/* Tombol Submit Final */}
                  <Button
                    type="submit" // Akan memicu handleSubmit() di tag <Form> atas
                    variant={semuaLulus ? "primary" : "secondary"}
                    isDisabled={
                      !semuaLulus ||
                      adaGambarFraud ||
                      adaGambarLoading ||
                      totalGambar === 0
                    }
                    className="w-full font-semibold shadow-sm"
                  >
                    Submit
                  </Button>
                </div>
              </Form>
            </Card.Content>
          </Card>
        </div>

        <div className="lg:col-start-3 mb-10">
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
