"use client";

import AppBar from "@/components/layout/Appbar";
import { useProgramList } from "@/hooks/useProgramList";
import { useReportStore } from "@/store/useReportStore";
import { Card } from "@heroui/react";
import { useEffect } from "react";
import { CiImageOn } from "react-icons/ci";
import DetectionDropzone from "./DetectionDropzone";
import FormDetection from "./form-detection";
import GridPreview from "./gridPreview";

export default function DetectionPage() {
  const { resetStore } = useReportStore();
  const { programs } = useProgramList({ purpose: "EVIDENCE" });

  useEffect(() => {
    return () => resetStore();
  }, [resetStore]);

  return (
    <div className="w-full space-y-6">
      <AppBar
        title="Kirim Bukti Kegiatan"
        description="Unggah 1 hingga 2 foto sebagai bukti kegiatan budaya unit kerja Anda."
        showAddButton={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 w-full max-w-6xl mx-auto gap-6 px-4 items-start">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <FormDetection programs={programs} />
        </div>

        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card className="w-full p-6 shadow-sm" variant="default">
            <Card.Content>
              <h2 className="text-lg mb-4 font-semibold text-gray-800">
                Bukti Foto
              </h2>
              <DetectionDropzone />
              <GridPreview />
            </Card.Content>
          </Card>

          <Card className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex flex-row items-center justify-start gap-2">
              <CiImageOn className="text-lg text-blue-600" />
              <Card.Header>
                <Card.Title className="text-sm font-medium text-blue-900">
                  Petunjuk Pengunggahan:
                </Card.Title>
              </Card.Header>
            </div>
            <Card.Content className="px-6">
              <ul className="space-y-1 text-xs text-blue-800 list-disc">
                <li>Wajib mengunggah minimal 1 dan maksimal 2 foto.</li>
                <li>Foto dikirim sebagai bukti untuk pemeriksaan Admin.</li>
                <li>Pastikan foto jelas dan sesuai kegiatan yang dilaporkan.</li>
              </ul>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
