"use client";

import { Card, Spinner } from "@heroui/react";
import { useRef } from "react";
import { FiAlertCircle, FiUploadCloud } from "react-icons/fi";
import { LuSparkle } from "react-icons/lu";
import { MdOutlineApartment, MdOutlinePerson } from "react-icons/md";

interface RequiredColumn {
  icon?: React.ReactNode;
  label: string;
}

interface UploadFileStepProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  isDisabled?: boolean;
  errorMsg: string | null;
  requiredColumns?: RequiredColumn[];
}

const DEFAULT_REQUIRED_COLUMNS: RequiredColumn[] = [
  {
    icon: <MdOutlinePerson size={16} className="text-blue-500" />,
    label: "NIP, Nama, Jabatan",
  },
  {
    icon: <MdOutlineApartment size={16} className="text-green-500" />,
    label: "Unit Kerja & Wilayah",
  },
];

export default function UploadFileStep({
  onFileSelect,
  isLoading,
  isDisabled = false,
  errorMsg,
  requiredColumns = DEFAULT_REQUIRED_COLUMNS,
}: UploadFileStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    onFileSelect(selected);

    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isDisabled || isLoading) return;
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    onFileSelect(dropped);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleClick = () => {
    if (isDisabled || isLoading) return;
    inputRef.current?.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <input
          ref={inputRef}
          id="excel-upload-file"
          type="file"
          accept=".xlsx, .xls, .csv"
          className="hidden"
          onChange={handleFileChange}
        />

        <div
          className={
            "border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center " +
            "text-center transition-colors duration-200 " +
            (isDisabled
              ? "bg-gray-50 border-gray-200 cursor-not-allowed opacity-60"
              : "bg-white cursor-pointer hover:border-blue-400 hover:bg-blue-50/30")
          }
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          aria-disabled={isDisabled}
          aria-label="Area upload file excel"
          onKeyDown={(e) => {
            if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
              inputRef.current?.click();
            }
          }}
        >
          {isDisabled ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gray-300 flex items-center justify-center mb-5">
                <FiUploadCloud size={32} className="text-white" />
              </div>
              <p className="font-semibold text-gray-400 text-lg">
                Upload File Excel
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Pilih Kategori Program Budaya terlebih dahulu
              </p>
            </>
          ) : isLoading ? (
            <>
              <Spinner size="lg" />
              <p className="mt-4 font-semibold text-gray-700">
                Memproses file...
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center mb-5 shadow-lg bg-whiteshadow-blue-200">
                <FiUploadCloud size={32} className="text-white" />
              </div>

              <p className="font-semibold text-gray-800 text-lg">
                Drag &amp; drop file Excel ke sini
              </p>
              <p className="text-sm text-gray-500 mt-1">
                atau{" "}
                <span className="text-blue-500 underline underline-offset-2 font-medium">
                  klik untuk memilih file
                </span>
              </p>

              <div className="flex gap-2 mt-4">
                {[".xlsx", ".xls", ".csv"].map((ext) => (
                  <span
                    key={ext}
                    className="px-3 py-1 text-xs font-mono font-medium bg-gray-100 text-gray-600 rounded-full"
                  >
                    {ext}
                  </span>
                ))}
              </div>

              <p className="text-xs text-gray-400 mt-3">
                Ukuran maksimum 10MB &middot; Maksimum 1.000 baris per import
              </p>
            </>
          )}

          {errorMsg && (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <FiAlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* KOLOM KANAN */}
      <div className="flex flex-col gap-3">
        <Card className="bg-sky-900 text-white p-5 rounded-xl">
          <Card.Header className="p-0 gap-2">
            <span>
              <LuSparkle size={20} />
            </span>

            <Card.Title className="text-white text-sm font-semibold">
              Panduan Cepat
            </Card.Title>

            <Card.Description className="p-0 mt-2 text-blue-100 text-xs leading-relaxed">
              Pastikan file Excel mengikuti format template resmi untuk hasil
              terbaik.
            </Card.Description>
          </Card.Header>
        </Card>

        <Card className="p-4 rounded-2xl">
          <Card.Header className="p-0 pb-3">
            <Card.Title className="text-sm font-semibold text-gray-800">
              Kolom yang Wajib Diisi
            </Card.Title>
          </Card.Header>
          <Card.Content className="p-0 flex flex-col gap-2">
            {requiredColumns.map((col) => (
              <div key={col.label} className="flex items-center gap-3">
                {col.icon && (
                  <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    {col.icon}
                  </div>
                )}
                <span className="text-xs text-gray-700 font-medium">
                  {col.label}
                </span>
              </div>
            ))}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
