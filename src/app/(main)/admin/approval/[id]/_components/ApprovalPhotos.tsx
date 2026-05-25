import { ActivityReportItem } from "@/types/report.types";
import { Card, Chip } from "@heroui/react";
import Image from "next/image";
import { FiImage } from "react-icons/fi";

interface ApprovalPhotosProps {
  report: ActivityReportItem | null;
}

export default function ApprovalPhotos({ report }: ApprovalPhotosProps) {
  return (
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
        {report?.photos?.map((photo, idx) => (
          <div
            key={idx}
            className="relative w-full h-40 overflow-hidden rounded-xl group cursor-pointer"
          >
            <Image
              src={photo.imageUrl}
              alt={`Foto ${idx + 1}`}
              width={500}
              height={500}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ))}
        {(!report?.photos || report.photos.length === 0) && (
          <div className="col-span-full py-8 text-center text-gray-500 text-sm">
            Tidak ada foto dokumentasi.
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
