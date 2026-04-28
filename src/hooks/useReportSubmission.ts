import { useState } from "react";
import { useReportStore } from "@/store/useReportStore";

export interface ReportFormData {
  activityName: string;
  quarterPeriod: string;
  year: string;
  claimedCount: string;
}

export function useReportSubmission() {
  const { images, updateImageStatus, resetStore } = useReportStore();

  const [loadingText, setLoadingText] = useState("");

  const handleCheckFraud = async () => {
    const imageNotCheck = images.filter((img) => img.status === "IDLE");
    if (imageNotCheck.length === 0) return;

    setLoadingText("Ai sedang memeriksa foto Anda...");
    imageNotCheck.forEach((img) => updateImageStatus(img.id, "LOADING"));

    try {
      const formData = new FormData();
      imageNotCheck.forEach((img) => {
        formData.append("foto_baru", img.file);
      });

      const response = await fetch("/api/fraud-check", {
        method: "POST",
        body: formData,
      });

      const hasil = await response.json();

      if (!response.ok) {
        throw new Error(hasil.message || "Gagal memeriksa fraud");
      }

      const rapor = hasil.data.detail_gambar;

      imageNotCheck.forEach((img) => {
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
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat mengecek fraud. Silakan coba lagi.");
      imageNotCheck.forEach((img) => updateImageStatus(img.id, "IDLE"));
    } finally {
      setLoadingText("");
    }
  };

  const tanganiSubmitFinal = async (dataForm: ReportFormData) => {
    if (
      !dataForm.activityName ||
      !dataForm.quarterPeriod ||
      !dataForm.year ||
      !dataForm.claimedCount
    ) {
      alert("Data belum lengkap! Harap isi semua informasi laporan.");
      return;
    }

    setLoadingText("Sedang mengunggah gambar ke awan...");

    try {
      const uploadPromises = images.map(async (img) => {
        const formData = new FormData();
        formData.append("file", img.file);

        const responUpload = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const hasilUpload = await responUpload.json();

        if (!responUpload.ok) throw new Error(hasilUpload.error);

        return {
          originalName: img.file.name,
          imageUrl: hasilUpload.url,
        };
      });

      const fotoBerhasilUpload = await Promise.all(uploadPromises);

      setLoadingText("Sedang menyimpan laporan...");

      const responDatabase = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityName: dataForm.activityName,
          quarterPeriod: dataForm.quarterPeriod,
          year: dataForm.year as string,
          claimedCount: Number(dataForm.claimedCount),
          uploadedPhotos: fotoBerhasilUpload,
        }),
      });

      if (!responDatabase.ok) throw new Error("Gagal menyimpan ke database");

      alert("Laporan berhasil dikirim dan tersimpan aman!");
      resetStore();
    } catch (error) {
      console.error(error);
      alert("Proses submit gagal. Cek koneksi internetmu.");
    } finally {
      setLoadingText("");
    }
  };

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
