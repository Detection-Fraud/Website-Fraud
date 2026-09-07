"use client";

import type { ImportantInformationItem } from "@/types/important-information";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { PiUploadSimple } from "react-icons/pi";
import InformasiPentingPreview from "./InformasiPentingPreview";

interface InformasiPentingFormModalProps {
  isOpen: boolean;
  item: ImportantInformationItem | null;
  onClose: () => void;
  onSubmit: (input: { altText: string; file?: File }) => Promise<void>;
  isPending?: boolean;
  submitError?: string | null;
}

export default function InformasiPentingFormModal({
  isOpen,
  item,
  onClose,
  onSubmit,
  isPending = false,
  submitError,
}: InformasiPentingFormModalProps) {
  const isEditMode = !!item;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [altText, setAltText] = useState(item?.altText ?? "");
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    item?.imageUrl ?? null,
  );
  const [dimensions, setDimensions] = useState<
    { width: number; height: number } | undefined
  >(item ? { width: item.width, height: item.height } : undefined);
  const [fileError, setFileError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(item?.imageUrl ?? null);
  const pendingObjectUrlsRef = useRef(new Set<string>());
  const decodeGenerationRef = useRef(0);

  const revokeBlobUrl = (url: string) => {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  };

  const invalidatePendingDecodes = useCallback(() => {
    decodeGenerationRef.current += 1;
    for (const url of pendingObjectUrlsRef.current) revokeBlobUrl(url);
    pendingObjectUrlsRef.current.clear();
  }, []);

  const invalidateObjectUrls = useCallback(() => {
    invalidatePendingDecodes();
    if (previewUrlRef.current) revokeBlobUrl(previewUrlRef.current);
    previewUrlRef.current = null;
  }, [invalidatePendingDecodes]);

  useEffect(() => {
    if (!isOpen) {
      invalidateObjectUrls();
      return;
    }
    invalidateObjectUrls();
    previewUrlRef.current = item?.imageUrl ?? null;
    setAltText(item?.altText ?? "");
    setFile(undefined);
    setFileError(null);
    setLocalError(null);
    setPreviewUrl(item?.imageUrl ?? null);
    setDimensions(
      item ? { width: item.width, height: item.height } : undefined,
    );
  }, [isOpen, item, invalidateObjectUrls]);

  useEffect(() => {
    return invalidateObjectUrls;
  }, [invalidateObjectUrls]);

  const handleFile = (candidate: File | undefined) => {
    if (!candidate) return;
    invalidatePendingDecodes();
    if (!["image/jpeg", "image/png"].includes(candidate.type)) {
      setFileError("Format file harus JPEG atau PNG");
      return;
    }
    if (candidate.size > 2 * 1024 * 1024) {
      setFileError("Ukuran file maksimal 2 MB");
      return;
    }

    const previousPreviewUrl = previewUrlRef.current;
    if (previousPreviewUrl) revokeBlobUrl(previousPreviewUrl);
    previewUrlRef.current = null;
    const url = URL.createObjectURL(candidate);
    pendingObjectUrlsRef.current.add(url);
    const generation = decodeGenerationRef.current;
    const image = new Image();
    image.onload = () => {
      pendingObjectUrlsRef.current.delete(url);
      if (generation !== decodeGenerationRef.current || !isOpen) {
        revokeBlobUrl(url);
        return;
      }
      if (previousPreviewUrl && previousPreviewUrl !== url) {
        revokeBlobUrl(previousPreviewUrl);
      }
      previewUrlRef.current = url;
      setFile(candidate);
      setPreviewUrl(url);
      setDimensions({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      setFileError(null);
    };
    image.onerror = () => {
      pendingObjectUrlsRef.current.delete(url);
      revokeBlobUrl(url);
      if (generation !== decodeGenerationRef.current || !isOpen) return;
      setFileError("Gambar tidak dapat dipreview");
    };
    image.src = url;
  };

  const handleClose = () => {
    if (isPending) return;
    invalidateObjectUrls();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    const trimmedAlt = altText.trim();

    if (!file && !item) {
      setFileError("Gambar wajib diunggah");
      return;
    }
    if (!trimmedAlt) {
      setLocalError("Teks alternatif wajib diisi");
      return;
    }

    try {
      await onSubmit({
        altText: trimmedAlt,
        ...(file ? { file } : {}),
      });
    } catch {
      // The parent owns the mutation error. Keeping this catch silent avoids
      // rendering a stale prop value or replacing the server message.
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center" scroll="inside">
          <Modal.Dialog
            aria-labelledby="modal-title"
            className="flex max-h-[calc(100dvh-3rem)] w-[calc(100vw-2rem)] max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
          >
            <Modal.CloseTrigger />

            <Modal.Header className="shrink-0 border-b border-slate-100 p-5 pb-4">
              <Modal.Heading
                id="modal-title"
                className="text-xl font-bold text-slate-800"
              >
                {isEditMode
                  ? "Edit Informasi Penting"
                  : "Tambah Informasi Penting"}
              </Modal.Heading>
            </Modal.Header>

            <Form onSubmit={handleSubmit} className="contents">
              <Modal.Body className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    {/* Upload Area */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-slate-700">
                        File Gambar {isEditMode ? "(Opsional)" : "(Wajib)"}
                      </Label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label="Pilih file gambar untuk informasi penting"
                        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition-colors hover:border-blue-500 focus:border-blue-500 focus:outline-none"
                      >
                        <PiUploadSimple className="mb-2 h-8 w-8 text-slate-400" />
                        <p className="text-sm font-medium text-slate-700">
                          {file
                            ? file.name
                            : isEditMode
                              ? "Klik untuk mengganti gambar"
                              : "Pilih file gambar"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          JPEG/PNG, maksimal 2 MB (rekomendasi rasio 2:1)
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          aria-describedby={fileError ? "file-error" : undefined}
                          onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                      </div>
                      {fileError && (
                        <p id="file-error" role="alert" className="mt-1 text-xs text-red-500">
                          {fileError}
                        </p>
                      )}
                    </div>

                    <TextField
                      isRequired
                      name="altText"
                      value={altText}
                      onChange={setAltText}
                      maxLength={300}
                    >
                      <Label className="text-sm font-medium text-slate-700">
                        Teks alternatif
                      </Label>
                      <Input placeholder="Contoh: Informasi Libur Nasional dan Cuti Bersama" />
                      <p className="mt-1 text-xs text-slate-400">
                        Digunakan pembaca layar untuk menggambarkan gambar ({altText.length}/300 karakter).
                      </p>
                      <FieldError />
                    </TextField>

                    {!isEditMode && (
                      <p className="text-xs italic text-slate-500">
                        Informasi baru akan disimpan sebagai nonaktif.
                      </p>
                    )}
                  </div>

                  <InformasiPentingPreview
                    previewUrl={previewUrl}
                    altText={altText}
                    dimensions={dimensions}
                  />
                </div>

                {(localError || submitError) && (
                  <p
                    role="alert"
                    className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-200"
                  >
                    {localError || submitError}
                  </p>
                )}
              </Modal.Body>

              <Modal.Footer className="shrink-0 border-t border-slate-100 p-4 px-5 flex justify-end gap-2 bg-slate-50/50">
                <Button
                  variant="outline"
                  onPress={handleClose}
                  isDisabled={isPending}
                >
                  Batal
                </Button>
                <Button type="submit" isPending={isPending}>
                  {isEditMode ? "Simpan Perubahan" : "Simpan sebagai Nonaktif"}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
