"use client";

import Dropzone from "@/components/ui/Dropzone";
import { useReportStore } from "@/store/useReportStore";
import { toast } from "@heroui/react";

export default function DetectionDropzone() {
  const { addImages, images } = useReportStore();

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    if (files.length + images.length > 2) {
      toast.danger("Maksimal hanya 2 foto yang dapat diunggah");
      return;
    }

    const newImages = files.slice(0, 2 - images.length).map((file) => ({
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "IDLE" as const,
    }));
    addImages(newImages);
  };

  return (
    <Dropzone
      multiple
      maxFiles={2}
      maxSizeMb={2}
      variant="normal"
      isDisabled={images.length >= 2}
      onFileSelected={handleFilesSelected}
    />
  );
}
