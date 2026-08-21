"use client";

import { useProgramList } from "@/hooks/useProgramList";
import { useReportDetail } from "@/hooks/useReportDetail";
import { useReportStore } from "@/store/useReportStore";
import { Card, Link, Spinner } from "@heroui/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import DetectionDropzone from "../../../_components/DetectionDropzone";
import FormDetection from "../../../_components/form-detection";
import GridPreview from "../../../_components/gridPreview";

export default function EditDetectionView() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { resetStore } = useReportStore();

  const { programs, isLoading: loadingPrograms } = useProgramList();
  const { report, loading: isLoadingReport } = useReportDetail(id);

  useEffect(() => {
    return () => resetStore();
  }, [resetStore]);

  if (isLoadingReport || loadingPrograms) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <Spinner size="lg" />
      </div>
    );
  }

  const initialDataMapped = report
    ? {
        activityName: report.activityName,
        programId: report.program?.id,
        tanggalKegiatan: report.tanggalKegiatan
          ? new Date(report.tanggalKegiatan).toISOString()
          : undefined,
        lokasi: report.lokasi,
        description: report.description,
      }
    : undefined;

  return (
    <div className="w-full space-y-6">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-4">
          <Link href={`/pic/submit/${id}`} className="text-sm font-semibold">
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
            <DetectionDropzone />
            <GridPreview />
          </Card.Content>
        </Card>

        <div className="lg:col-span-1">
          <FormDetection
            programs={programs}
            initialData={initialDataMapped}
            reportId={id}
          />
        </div>
      </div>
    </div>
  );
}
