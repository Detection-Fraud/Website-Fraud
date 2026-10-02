"use client";

import Dropzone from "@/components/ui/Dropzone";
import { Button, Label } from "@heroui/react";
import Image from "next/image";
import { FiX } from "react-icons/fi";

interface ProgramBannerFieldProps {
  bannerUrl: string | null;
  isUploading: boolean;
  isDeletingUpload: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}

export default function ProgramBannerField({
  bannerUrl,
  isUploading,
  isDeletingUpload,
  onUpload,
  onRemove,
}: ProgramBannerFieldProps) {
  const handleBannerUpload = async (file?: File) => {
    if (!file) return;

    try {
      await onUpload(file);
    } catch (error) {
      console.error("Gagal mengunggah banner", error);
    }
  };

  const handleRemoveBanner = async () => {
    try {
      await onRemove();
    } catch {
      // Error toast ditangani oleh useUploadMutation.
    }
  };

  return (
    <div className="space-y-2">
      <Label>Poster atau banner kegiatan</Label>

      {bannerUrl ? (
        <div className="relative h-32 overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800">
          <Image
            alt="Pratinjau banner program"
            className="object-cover"
            fill
            src={bannerUrl}
            unoptimized
          />
          <Button
            aria-label="Hapus banner"
            className="absolute right-2 top-2 bg-slate-900/80 text-white"
            isIconOnly
            isDisabled={isDeletingUpload}
            onPress={handleRemoveBanner}
            type="button"
          >
            <FiX className="size-4" />
          </Button>
        </div>
      ) : (
        <Dropzone
          isDisabled={isUploading || isDeletingUpload}
          label={
            isUploading
              ? "Mengunggah..."
              : isDeletingUpload
                ? "Menghapus file sementara..."
                : "Klik atau seret poster ke sini"
          }
          maxSizeMb={2}
          onFileSelected={(files) => handleBannerUpload(files[0])}
          variant="compact"
        />
      )}
    </div>
  );
}
