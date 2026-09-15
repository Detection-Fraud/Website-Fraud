"use client";

import Dropzone from "@/components/ui/Dropzone";
import { useTemporaryUpload } from "@/hooks/useUploadMutation";
import { Button, Label } from "@heroui/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";

interface ProgramBannerFieldProps {
  initialBannerUrl?: string | null;
  isOpen: boolean;
  onUploadingChange: (isUploading: boolean) => void;
}

export default function ProgramBannerField({
  initialBannerUrl,
  isOpen,
  onUploadingChange,
}: ProgramBannerFieldProps) {
  const {
    uploadTemporaryFile,
    discardTemporaryUpload,
    isUploading,
    isDeletingUpload,
  } = useTemporaryUpload(isOpen);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setBannerUrl(initialBannerUrl ?? null);
  }, [initialBannerUrl, isOpen]);

  useEffect(() => {
    onUploadingChange(isUploading || isDeletingUpload);
  }, [isDeletingUpload, isUploading, onUploadingChange]);

  const handleBannerUpload = async (file?: File) => {
    if (!file) return;

    try {
      const result = await uploadTemporaryFile(file);
      if (!result) return;
      setBannerUrl(result.url);
    } catch (error) {
      console.error("Gagal mengunggah banner", error);
    }
  };

  const handleRemoveBanner = async () => {
    try {
      await discardTemporaryUpload();
      setBannerUrl(null);
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
          maxSizeMb={3}
          onFileSelected={(files) => handleBannerUpload(files[0])}
          variant="compact"
        />
      )}

      <input name="bannerUrl" type="hidden" value={bannerUrl ?? ""} />
    </div>
  );
}
