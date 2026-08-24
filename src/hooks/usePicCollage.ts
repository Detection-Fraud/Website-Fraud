"use client";

import { api } from "@/lib/api";
import {
  CollageGalleryPayload,
  CollageOptionsPayload,
} from "@/types/collage.types";
import { useMutation, useQuery } from "@tanstack/react-query";

export function usePicCollageOptions() {
  return useQuery<CollageOptionsPayload>({
    queryKey: ["pic-collage-options"],
    queryFn: () =>
      api.get("/reports/collage/options").then((response) => response.data),
    staleTime: 30_000,
  });
}

export function usePicCollageGallery(programId: string, page: number) {
  return useQuery<CollageGalleryPayload>({
    queryKey: ["pic-collage", { programId, page, limit: 12 }],
    queryFn: () =>
      api
        .get("/reports/collage", { params: { programId, page, limit: 12 } })
        .then((response) => response.data),
    enabled: Boolean(programId),
    staleTime: 30_000,
  });
}

export function useDownloadPicCollage() {
  return useMutation<Blob, Error, string>({
    mutationFn: (programId) =>
      api
        .get("/reports/export-collage", {
          params: { programId },
          responseType: "blob",
        })
        .then((response) => response.data),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "kolase-foto.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
}
