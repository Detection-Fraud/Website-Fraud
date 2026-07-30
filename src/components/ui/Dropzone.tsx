"use client";

import { cn } from "@/lib/utils";
import { Label, toast } from "@heroui/react";
import { useState } from "react";
import { FiImage, FiUpload } from "react-icons/fi";

export interface DropzoneProps {
  onFileSelected: (files: File[]) => void;

  multiple?: boolean;

  maxFiles?: number;

  maxSizeMb?: number;

  accept?: string;
  variant?: "normal" | "compact";
  label?: string;
  className?: string;
  isDisabled?: boolean;
}

export default function Dropzone({
  onFileSelected,
  multiple = false,
  maxFiles = multiple ? 2 : 1,
  maxSizeMb = 2,
  accept = "image/jpeg, image/png, image/jpg",
  variant = "normal",
  label = "Klik untuk upload atau seret & lepas file di sini",
  className,
  isDisabled = false,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  const validateAndEmitFiles = (rawFiles: FileList | File[]) => {
    if (isDisabled) return;
    const list = Array.from(rawFiles);
    if (list.length === 0) return;

    const fileLimit = multiple ? maxFiles : 1;
    const selected = list.slice(0, fileLimit);

    if (list.length > fileLimit) {
      toast.warning(`Hanya ${fileLimit} file yang diproses.`);
    }

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    selected.forEach((file) => {
      if (file.size > maxSizeBytes) {
        invalidFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      toast.danger(`File melebihi ${maxSizeMb}MB: ${invalidFiles.join(", ")}`);
    }
    if (validFiles.length > 0) {
      onFileSelected(validFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDisabled) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      validateAndEmitFiles(e.dataTransfer.files);
    }
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndEmitFiles(e.target.files);
      e.target.value = ""; // Reset value agar file yang sama bisa dipilih kembali
    }
  };

  const isCompact = variant === "compact";

  return (
    <div className={cn("w-full", className)}>
      <Label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 select-none",
          isCompact ? "h-32 px-4 py-2" : "h-52 px-6 py-4",
          isDragging
            ? "border-primary bg-primary/5 scale-[0.99]"
            : "border-slate-300 hover:border-primary hover:bg-slate-50/50",
          isDisabled &&
            "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50",
        )}
      >
        <div className="flex flex-col items-center justify-center text-center">
          {isCompact ? (
            <FiImage size={24} className="mb-1.5 text-slate-400 shrink-0" />
          ) : (
            <FiUpload size={32} className="mb-3 text-slate-400 shrink-0" />
          )}
          <p
            className={cn(
              "font-medium text-slate-700",
              isCompact ? "text-xs" : "text-sm",
            )}
          >
            <span className="text-primary font-semibold hover:underline">
              {label}
            </span>
          </p>

          <p
            className={cn(
              "text-slate-400 mt-1",
              isCompact ? "text-[10px]" : "text-xs",
            )}
          >
            {accept.includes("image") ? "PNG, JPG, atau JPEG" : "File"} (Maks.{" "}
            {maxSizeMb}MB)
          </p>
        </div>

        <input
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept}
          onChange={handleSelectFile}
          disabled={isDisabled}
        />
      </Label>
    </div>
  );
}
