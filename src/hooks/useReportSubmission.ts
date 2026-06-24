import { api } from "@/lib/api";
import { useReportStore } from "@/store/useReportStore";
import { ReportFormData } from "@/types/report.types";
import { toast } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useReportSubmission(reportId?: string, onSuccess?: () => void) {
  const { images, updateImageStatus, resetStore } = useReportStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [loadingText, setLoadingText] = useState("");

  // --- Mutation 1: Fraud Check ---
  const fraudCheckMutation = useMutation({
    mutationFn: async (imagesToCheck: typeof images) => {
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
      const rapor = data.data.detail_gambar;
      imagesToCheck.forEach((img) => {
        const hasilGambarIni = rapor.find(
          (r: any) => r.nama_file === img.file.name,
        );
        if (hasilGambarIni) {
          if (hasilGambarIni.status === "FRAUD") {
            updateImageStatus(
              img.id,
              "FRAUD",
              hasilGambarIni.url_referensi_pelaku,
            );
          } else {
            updateImageStatus(img.id, "LULUS");
          }
        } else {
          updateImageStatus(img.id, "IDLE");
        }
      });
    },
    onError: (_, imagesToCheck) => {
      toast.danger("Terjadi kesalahan saat mengecek fraud. Silakan coba lagi.");
      imagesToCheck.forEach((img) => updateImageStatus(img.id, "IDLE"));
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
      const uploadPromises = images.map(async (img) => {
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
      router.push("/pic/dashboard");
      resetStore();
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        (error instanceof Error ? error.message : "Terjadi kesalahan tidak terduga");
      toast.danger(message);
    },
    onSettled: () => {
      setLoadingText("");
    },
  });

  // --- Handlers ---
  const handleCheckFraud = async () => {
    const imageNotCheck = images.filter((img) => img.status === "IDLE");
    if (imageNotCheck.length === 0) return;
    imageNotCheck.forEach((img) => updateImageStatus(img.id, "LOADING"));
    fraudCheckMutation.mutate(imageNotCheck);
  };

  const tanganiSubmitFinal = async (dataForm: ReportFormData) => {
    if (
      !dataForm.activityName ||
      !dataForm.programId ||
      !dataForm.lokasi ||
      !dataForm.tanggalKegiatan ||
      !dataForm.picKegiatan ||
      !dataForm.description
    ) {
      toast.danger("Data belum lengkap! Harap isi semua informasi laporan.");
      return;
    }
    submitMutation.mutate(dataForm);
  };

  // --- Derived state (tetap sama) ---
  const adaGambarIdle = images.some((img) => img.status === "IDLE");
  const adaGambarFraud = images.some((img) => img.status === "FRAUD");
  const adaGambarLoading = images.some((img) => img.status === "LOADING");
  const semuaLulus =
    images.length > 0 && images.every((img) => img.status === "LULUS");
  const totalGambar = images.length;

  return {
    loadingText,
    handleCheckFraud,
    tanganiSubmitFinal,
    adaGambarIdle,
    adaGambarFraud,
    adaGambarLoading,
    semuaLulus,
    totalGambar,
  };
}
