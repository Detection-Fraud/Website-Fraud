import { api } from "@/lib/api";
import { useReportStore } from "@/store/useReportStore";
import {
  useUploadMutation,
  type UploadCleanupCredential,
} from "@/hooks/useUploadMutation";
import { ReportFormData } from "@/types/report.types";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function useReportSubmission(reportId?: string, onSuccess?: () => void, expectedUpdatedAt?: string) {
  const imageStore = useReportStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [loadingText, setLoadingText] = useState("");
  const [isSubmitLocked, setIsSubmitLocked] = useState(false);
  const submitStarted = useRef(false);
  const { uploadFile, deleteUploadedFile } = useUploadMutation();

  // --- Mutation 1: Fraud Check ---
  const fraudCheckMutation = useMutation({
    mutationFn: async (imagesToCheck: typeof imageStore.images) => {
      const formData = new FormData();
      imagesToCheck.forEach((img) => formData.append("foto_baru", img.file));
      const res = await api.post("/fraud-check", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onMutate: () => {
      setLoadingText("Ai sedang memeriksa foto Anda...");
    },
    onSuccess: (data, imagesToCheck) => {
      const rapor = data.detail_gambar;
      imagesToCheck.forEach((img) => {
        const hasilGambarIni = rapor.find(
          (r: any) => r.nama_file === img.file.name,
        );
        if (hasilGambarIni) {
          if (hasilGambarIni.status === "FRAUD") {
            imageStore.updateImageStatus(
              img.id,
              "FRAUD",
              hasilGambarIni.url_referensi_pelaku,
            );
          } else {
            imageStore.updateImageStatus(img.id, "LULUS");
          }
        } else {
          imageStore.updateImageStatus(img.id, "IDLE");
        }
      });
    },
    onError: (error: any, imagesToCheck) => {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      let message = "Pemeriksaan foto gagal. Silakan coba lagi.";

      if (axios.isAxiosError(error) && !error.response) {
        message = "Tidak dapat terhubung ke aplikasi. Periksa koneksi internet Anda, lalu coba lagi.";
      } else if (status === 429) {
        message = "Pemeriksaan sedang sibuk. Silakan coba lagi beberapa saat.";
      } else if (status !== undefined && status >= 500) {
        message = "Layanan pemeriksaan foto sedang tidak tersedia. Silakan coba lagi beberapa saat.";
      } else if (status === 400 || status === 413) {
        const apiMessage = error.response?.data?.message;
        if (typeof apiMessage === "string" && apiMessage.trim()) {
          message = apiMessage;
        }
      }

      toast.danger(message);
      imagesToCheck.forEach((img) =>
        imageStore.updateImageStatus(img.id, "IDLE"),
      );
    },
    onSettled: () => {
      setLoadingText("");
    },
  });

  // --- Mutation 2: Submit Final (Upload + Save) ---
  const submitMutation = useMutation({
    mutationFn: async (dataForm: ReportFormData) => {
      setLoadingText("Sedang mengunggah gambar ke awan...");

      const cleanupCredentials: UploadCleanupCredential[] = [];
      const uploadedPhotos: NonNullable<ReportFormData["uploadedPhotos"]> = [];
      const uploadOptions = {
        purpose: "EVIDENCE" as const,
        mode: reportId ? ("REPLACEMENT" as const) : ("CREATE" as const),
        ...(reportId ? { reportId } : {}),
      };

      try {
        for (const img of imageStore.images) {
          const uploaded = await uploadFile({ file: img.file, options: uploadOptions });

          cleanupCredentials.push({
            publicId: uploaded.publicId,
            descriptor: uploaded.descriptor,
            cleanupToken: uploaded.cleanupToken,
            ...uploadOptions,
          });

          uploadedPhotos.push({
            originalName: img.file.name,
            imageUrl: uploaded.url,
            publicId: uploaded.publicId,
            descriptor: uploaded.descriptor,
            cleanupToken: uploaded.cleanupToken,
          });
        }

        setLoadingText("Sedang menyimpan laporan...");

        const url = reportId ? `/reports/${reportId}` : "/reports";
        const method = reportId ? "put" : "post";

        const payload = reportId
          ? {
              ...dataForm,
              ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
              photos: uploadedPhotos,
            }
          : {
              ...dataForm,
              uploadedPhotos,
            };

        const res = await api[method](url, payload);
        return res.data;
      } catch (error) {
        await Promise.allSettled(
          cleanupCredentials.map((credential) =>
            deleteUploadedFile(credential),
          ),
        );

        throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        reportId ? "Laporan berhasil diupdate!" : "Laporan berhasil dikirim!",
      );
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      router.push("/pic/dashboard");
      imageStore.resetStore();
    },
    onError: (error: any) => {
      submitStarted.current = false;
      setIsSubmitLocked(false);
      const message =
        error?.response?.data?.message ||
        (error instanceof Error
          ? error.message
          : "Terjadi kesalahan tidak terduga");
      toast.danger(message);
    },
    onSettled: () => {
      setLoadingText("");
    },
  });

  // --- Handlers ---
  const handleCheckFraud = async () => {
    if (imageStore.isNoAiMode) return;

    const imageNotCheck = imageStore.images.filter(
      (img) => img.status === "IDLE",
    );
    if (imageNotCheck.length === 0) return;
    imageNotCheck.forEach((img) =>
      imageStore.updateImageStatus(img.id, "LOADING"),
    );
    fraudCheckMutation.mutate(imageNotCheck);
  };

  const tanganiSubmitFinal = async (dataForm: ReportFormData) => {
    if (submitStarted.current) return;
    if (
      !dataForm.activityName ||
      !dataForm.programId ||
      !dataForm.lokasi ||
      !dataForm.tanggalKegiatan ||
      !dataForm.description
    ) {
      toast.danger("Data belum lengkap! Harap isi semua informasi laporan.");
      return;
    }
    submitStarted.current = true;
    setIsSubmitLocked(true);
    submitMutation.mutate(dataForm);
  };

  // --- Derived state (tetap sama) ---
  const adaGambarIdle = imageStore.images.some((img) => img.status === "IDLE");
  const adaGambarFraud = imageStore.images.some(
    (img) => img.status === "FRAUD",
  );
  const adaGambarLoading = imageStore.images.some(
    (img) => img.status === "LOADING",
  );
  const semuaLulus =
    imageStore.images.length > 0 &&
    imageStore.images.every((img) => img.status === "LULUS");
  const totalGambar = imageStore.images.length;

  return {
    state: {
      images: imageStore.images,
      loadingText,
      isSubmitting: isSubmitLocked || submitMutation.isPending,
      adaGambarIdle,
      adaGambarFraud,
      adaGambarLoading,
      semuaLulus,
      totalGambar,
    },
    actions: {
      addImages: imageStore.addImages,
      removeImage: imageStore.removeImage,
      handleCheckFraud,
      tanganiSubmitFinal,
      resetStore: imageStore.resetStore,
    },
  };
}
