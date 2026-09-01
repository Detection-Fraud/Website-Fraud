import { api } from "@/lib/api";
import { useReportStore } from "@/store/useReportStore";
import { ReportFormData } from "@/types/report.types";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useReportSubmission(reportId?: string, onSuccess?: () => void) {
  const imageStore = useReportStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [loadingText, setLoadingText] = useState("");

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
    onError: (_, imagesToCheck) => {
      toast.danger("Terjadi kesalahan saat mengecek fraud. Silakan coba lagi.");
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
      // Step 1: Upload semua gambar
      setLoadingText("Sedang mengunggah gambar ke awan...");
      const uploadPromises = imageStore.images.map(async (img) => {
        const formData = new FormData();
        formData.append("file", img.file);
        const res = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return { originalName: img.file.name, imageUrl: res.data.url };
      });
      const fotoBerhasilUpload = await Promise.all(uploadPromises);

      // Step 2: Save ke database
      setLoadingText("Sedang menyimpan laporan...");
      const url = reportId ? `/reports/${reportId}` : "/reports";
      const method = reportId ? "put" : "post";
      const res = await api[method](url, {
        ...dataForm,
        uploadedPhotos: fotoBerhasilUpload,
        photos: fotoBerhasilUpload,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(
        reportId ? "Laporan berhasil diupdate!" : "Laporan berhasil dikirim!",
      );
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      router.push("/pic/halaman-utama");
      imageStore.resetStore();
    },
    onError: (error: any) => {
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
