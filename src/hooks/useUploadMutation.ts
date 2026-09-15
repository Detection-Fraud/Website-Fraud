import { api } from "@/lib/api";
import { toast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

export interface UploadReponse {
  message: string;
  url: string;
  publicId: string;
  cleanupToken: string;
  originalName?: string;
}

export type UploadCleanupCredential = Pick<
  UploadReponse,
  "publicId" | "cleanupToken"
>;

export function useUploadMutation() {
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<UploadReponse>("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return res.data;
    },
    onError: (err: any) => {
      toast.danger(
        "Gagal mengunggah file: " +
          (err.response?.data?.message || err.message),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (credential: UploadCleanupCredential) => {
      const res = await api.delete<{ deleted: boolean }>("/upload", {
        data: credential,
      });
      return res.data;
    },
    onError: (err: any) => {
      toast.danger(
        "Gagal menghapus file sementara: " +
          (err.response?.data?.message || err.message),
      );
    },
  });

  return {
    uploadFile: uploadMutation.mutateAsync,
    deleteUploadedFile: deleteMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    isDeletingUpload: deleteMutation.isPending,
    uploadError: uploadMutation.error,
  };
}

export function useTemporaryUpload(isActive = true) {
  const {
    uploadFile,
    deleteUploadedFile,
    isUploading,
    isDeletingUpload,
    uploadError,
  } = useUploadMutation();
  const pendingUploadRef = useRef<UploadCleanupCredential | null>(null);
  const cleanupPromiseRef = useRef<Promise<void> | null>(null);
  const isActiveRef = useRef(isActive);
  const uploadFileRef = useRef(uploadFile);
  const deleteUploadedFileRef = useRef(deleteUploadedFile);

  useEffect(() => {
    isActiveRef.current = isActive;
    uploadFileRef.current = uploadFile;
    deleteUploadedFileRef.current = deleteUploadedFile;
  }, [deleteUploadedFile, isActive, uploadFile]);

  const discardTemporaryUpload = useCallback(() => {
    if (cleanupPromiseRef.current) return cleanupPromiseRef.current;

    const pendingUpload = pendingUploadRef.current;
    if (!pendingUpload) return Promise.resolve();

    const cleanupRequest = deleteUploadedFileRef
      .current(pendingUpload)
      .then(() => {
        if (pendingUploadRef.current === pendingUpload) {
          pendingUploadRef.current = null;
        }
      })
      .finally(() => {
        if (cleanupPromiseRef.current === cleanupRequest) {
          cleanupPromiseRef.current = null;
        }
      });
    cleanupPromiseRef.current = cleanupRequest;
    return cleanupRequest;
  }, []);

  useEffect(() => {
    if (!isActive) void discardTemporaryUpload();
  }, [discardTemporaryUpload, isActive]);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      void discardTemporaryUpload();
    };
  }, [discardTemporaryUpload]);

  const uploadTemporaryFile = useCallback(
    async (file: File) => {
      await discardTemporaryUpload();
      const uploaded = await uploadFileRef.current(file);
      pendingUploadRef.current = {
        publicId: uploaded.publicId,
        cleanupToken: uploaded.cleanupToken,
      };

      if (!isActiveRef.current) {
        await discardTemporaryUpload();
        return null;
      }

      return uploaded;
    },
    [discardTemporaryUpload],
  );

  const preserveTemporaryUpload = useCallback(() => {
    pendingUploadRef.current = null;
  }, []);

  return {
    uploadTemporaryFile,
    discardTemporaryUpload,
    preserveTemporaryUpload,
    isUploading,
    isDeletingUpload,
    uploadError,
  };
}
