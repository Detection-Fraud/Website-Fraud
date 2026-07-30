import { api } from "@/lib/api";
import { toast } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";

export interface UploadReponse {
  message: string;
  url: string;
  publicId?: string;
  originalName?: string;
}

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

  return {
    uploadFile: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
  };
}
