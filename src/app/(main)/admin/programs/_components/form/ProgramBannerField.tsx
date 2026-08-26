"use client";

import Dropzone from "@/components/ui/Dropzone";
import { useUploadMutation } from "@/hooks/useUploadMutation";
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
  const { uploadFile, isUploading } = useUploadMutation();
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setBannerUrl(initialBannerUrl ?? null);
  }, [initialBannerUrl, isOpen]);

  useEffect(() => {
    onUploadingChange(isUploading);
  }, [isUploading, onUploadingChange]);

  const handleBannerUpload = async (file?: File) => {
    if (!file) return;

    try {
      const result = await uploadFile(file);
      setBannerUrl(result.url);
    } catch (error) {
      console.error("Gagal mengunggah banner", error);
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
            onPress={() => setBannerUrl(null)}
            type="button"
          >
            <FiX className="size-4" />
          </Button>
        </div>
      ) : (
        <Dropzone
          isDisabled={isUploading}
          label={
            isUploading ? "Mengunggah..." : "Klik atau seret poster ke sini"
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
