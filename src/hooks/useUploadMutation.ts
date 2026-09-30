import { api } from "@/lib/api";
import { toast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

export type UploadPurpose =
  | "EVIDENCE"
  | "PROGRAM_BANNER"
  | "CATEGORY_BANNER"
  | "LOGIN_BANNER";

export type UploadMode = "CREATE" | "REPLACEMENT";

export type UploadOptions = {
  purpose: UploadPurpose;
  mode: UploadMode;
  reportId?: string;
};

export interface UploadResponse {
  message: string;
  url: string;
  publicId: string;
  descriptor: string;
  cleanupToken: string;
  size: number;
  originalName?: string;
}

export type UploadReceipt = Pick<
  UploadResponse,
  "url" | "publicId" | "descriptor" | "cleanupToken"
>;

export type UploadCleanupCredential = Pick<
  UploadResponse,
  "publicId" | "descriptor" | "cleanupToken"
> &
  UploadOptions;

export type UploadFileArg = {
  file: File;
  options: UploadOptions;
};

export function useUploadMutation() {
  const uploadMutation = useMutation({
    mutationFn: async ({ file, options }: UploadFileArg) => {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("purpose", options.purpose);
      formData.append("mode", options.mode);

      if (options.reportId) formData.append("reportId", options.reportId);

      const response = await api.post<UploadResponse>("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    },

    onError: (error: any) => {
      toast.danger(
        "Gagal mengunggah file: " +
          (error.response?.data?.message || error.message),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (credential: UploadCleanupCredential) => {
      const response = await api.delete<{ deleted: boolean }>("/upload", {
        data: credential,
      });

      return response.data;
    },

    onError: (error: any) => {
      toast.danger(
        "Gagal menghapus file sementara: " +
          (error.response?.data?.message || error.message),
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

export function useTemporaryUpload(
  options: UploadOptions,
  isActive = true,
) {
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
    if (cleanupPromiseRef.current) {
      return cleanupPromiseRef.current;
    }

    const pendingUpload = pendingUploadRef.current;

    if (!pendingUpload) {
      return Promise.resolve();
    }

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
    if (!isActive) {
      void discardTemporaryUpload();
    }
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

      const uploaded = await uploadFileRef.current({
        file,
        options,
      });

      pendingUploadRef.current = {
        publicId: uploaded.publicId,
        descriptor: uploaded.descriptor,
        cleanupToken: uploaded.cleanupToken,
        ...options,
      };

      if (!isActiveRef.current) {
        await discardTemporaryUpload();
        return null;
      }

      return uploaded;
    },
    [discardTemporaryUpload, options],
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
