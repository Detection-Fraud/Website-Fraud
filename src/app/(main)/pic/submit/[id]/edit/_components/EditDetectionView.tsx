"use client";

import { useProgramList } from "@/hooks/useProgramList";
import { useReportDetail } from "@/hooks/useReportDetail";
import { useReportStore } from "@/store/useReportStore";
import { Card, Link, Spinner } from "@heroui/react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import DetectionDropzone from "../../../_components/DetectionDropzone";
import FormDetection from "../../../_components/form-detection";
import GridPreview from "../../../_components/gridPreview";

export default function EditDetectionView() {
  const { id } = useParams() as { id: string };
  const { resetStore } = useReportStore();

  const { programs, isLoading: loadingPrograms } = useProgramList({
    purpose: "EVIDENCE",
  });
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
            Silakan perbarui data laporan dan unggah 1 hingga 2 foto bukti baru.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 w-full max-w-6xl mx-auto gap-6 px-4 items-start">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <FormDetection
            programs={programs}
            initialData={initialDataMapped}
            reportId={id}
          />
        </div>

        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card className="w-full p-6 shadow-sm" variant="default">
            <Card.Content>
              <h2 className="text-lg mb-4 font-semibold text-gray-800">
                Bukti Foto Baru
              </h2>
              <DetectionDropzone />
              <GridPreview />
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
