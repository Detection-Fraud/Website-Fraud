"use client";

import { Alert, Label } from "@heroui/react";

type PreviewDimensions = { width: number; height: number };

type InformasiPentingPreviewProps = {
  previewUrl: string | null;
  altText: string;
  dimensions?: PreviewDimensions;
};

export default function InformasiPentingPreview({
  previewUrl,
  altText,
  dimensions,
}: InformasiPentingPreviewProps) {
  const mismatched = Boolean(
    dimensions && dimensions.width !== 2 * dimensions.height,
  );

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">
        Preview tampilan PIC
      </Label>

      <div className="relative aspect-[2/1] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={altText}
            className="size-full object-cover object-center"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-slate-400">
            Preview 2:1
          </div>
        )}
      </div>
      {dimensions && (
        <p className="text-xs text-slate-500">
          Dimensi {dimensions.width} × {dimensions.height} px
        </p>
      )}

      {mismatched && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            Rasio gambar tidak 2:1. Sebagian gambar mungkin tidak terlihat pada
            tampilan PIC.
          </Alert.Content>
        </Alert>
      )}
    </div>
  );
}
