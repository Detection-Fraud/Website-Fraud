"use client";

import { useReportSubmission } from "@/hooks/useReportSubmission";
import { useReportStore } from "@/store/useReportStore";
import { Card, Link, Spinner } from "@heroui/react";
import { useEffect, useState } from "react";
import { ProgramBudaya } from "@generated/prisma";
import { CiImageOn } from "react-icons/ci";
import Dropzone from "../../_components/dropzone";
import FormDetection, { InitialData } from "../../_components/form-detection";
import GridPreview from "../../_components/gridPreview";
import { useParams, useRouter } from "next/navigation";

export default function EditDetectionPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { resetStore } = useReportStore();

  const [programs, setPrograms] = useState<ProgramBudaya[]>([]);
  const [initialData, setInitialData] = useState<InitialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Memanggil hook dengan mode Edit
  const {
    loadingText,
    handleCheckFraud,
    tanganiSubmitFinal,
    adaGambarIdle,
    adaGambarFraud,
    adaGambarLoading,
    semuaLulus,
    totalGambar,
  } = useReportSubmission(id, () => {
    router.push(`/pic/dashboard`); // Kembali ke dashboard setelah sukses
  });

  // Fetch report data & program budaya
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [progRes, reportRes] = await Promise.all([
          fetch("/api/programs"),
          fetch(`/api/reports/${id}`),
        ]);

        if (progRes.ok) {
          const progJson = await progRes.json();
          setPrograms(progJson.data || []);
        }

        if (reportRes.ok) {
          const reportJson = await reportRes.json();
          const report = reportJson.data;
          setInitialData({
            activityName: report.activityName,
            programId: report.programId,
            tanggalKegiatan: report.tanggalKegiatan,
            lokasi: report.lokasi,
            picKegiatan: report.picKegiatan,
            description: report.description,
          });
        }
      } catch (error) {
        console.error("Gagal mengambil data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  useEffect(() => {
    return () => resetStore();
  }, [resetStore]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-4">
          <Link href={`/pic/detection/${id}`} className="text-sm font-semibold">
            &larr; Kembali ke Detail
          </Link>
        </div>
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-gray-900">
            Upload Ulang Foto Kegiatan
          </h3>
          <p className="text-gray-600 text-sm">
            Silakan perbarui data laporan dan unggah foto baru sebagai pengganti
            foto yang ditolak.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 w-full max-w-5xl mx-auto gap-6 px-4">
        <Card className="w-full p-6 lg:col-span-2 shadow-sm" variant="default">
          <Card.Content>
            <h2 className="text-lg mb-4 font-semibold text-gray-800">
              Bukti Foto Kegiatan Baru
            </h2>
            <Dropzone />
            <GridPreview />
          </Card.Content>
        </Card>

        <div className="lg:col-span-1">
          <FormDetection
            loadingText={loadingText}
            handleCheckFraud={handleCheckFraud}
            tanganiSubmitFinal={tanganiSubmitFinal}
            adaGambarIdle={adaGambarIdle}
            adaGambarFraud={adaGambarFraud}
            adaGambarLoading={adaGambarLoading}
            semuaLulus={semuaLulus}
            totalGambar={totalGambar}
            programs={programs}
            initialData={initialData || undefined}
          />
        </div>
      </div>
    </div>
  );
}
