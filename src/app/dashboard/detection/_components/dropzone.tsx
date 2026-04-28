"use client";

import React, { useState } from "react";
import { FiUpload } from "react-icons/fi";
import { useReportStore } from "@/store/useReportStore";
import { cn } from "@heroui/react";

export default function Dropzone() {
  const { addImages } = useReportStore();
  const [isDragging, setIsDragging] = useState(false);

  const prosessFileGambar = (fileFisik: FileList | File[]) => {
    const listFile = Array.from(fileFisik);

    const newImage = listFile.map((file) => ({
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file: file,
      previewUrl: URL.createObjectURL(file),
      status: "IDLE" as const,
    }));

    addImages(newImage);
  };

  // 1. SAAT FILE DISERET DI ATAS KOTAK (Belum dilepas)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Mencegah browser buka file di tab baru
    setIsDragging(true); // Ganti warna kotak jadi biru
  };

  // 2. SAAT FILE DISERET KELUAR KOTAK (Batal ditaruh)
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false); // Kembalikan warna kotak ke semula
  };

  // 3. SAAT FILE DILEPAS (DROP)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Di sinilah seharusnya kita menangkap file-nya!
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      prosessFileGambar(e.dataTransfer.files);
    }
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      prosessFileGambar(e.target.files);
      e.target.value = ""; // Reset agar file yang sama bisa dipilih ulang
    }
  };

  return (
    <div className="w-full">
      {/* Cukup gunakan label HTML bawaan. */}
      <label
        htmlFor="file-upload"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-primary",
        )}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <FiUpload size={32} className="mb-3 text-gray-500" />
          <p className="mb-2 text-sm text-gray-500">
            <span className="font-semibold text-blue-600">
              Klik untuk upload
            </span>{" "}
            atau seret dan lepas
          </p>
          <p className="text-xs text-gray-500">
            PNG, JPG, atau JPEG (Ukuran Maks. 2MB)
          </p>
        </div>

        {/* Cukup 1 input tersembunyi yang dipakai. */}
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          accept="image/*"
          onChange={handleSelectFile}
        />
      </label>
    </div>
  );
}
