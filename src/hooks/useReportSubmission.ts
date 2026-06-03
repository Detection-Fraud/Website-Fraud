import { useReportStore } from "@/store/useReportStore";
import { ReportFormData } from "@/types/report.types";
import { toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useReportSubmission(reportId?: string, onSuccess?: () => void) {
  const { images, updateImageStatus, resetStore } = useReportStore();

  const router = useRouter();

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
      toast.danger("Terjadi kesalahan saat mengecek fraud. Silakan coba lagi.");
      imageNotCheck.forEach((img) => updateImageStatus(img.id, "IDLE"));
    } finally {
      setLoadingText("");
    }
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

      const urlDatabase = reportId
        ? `/api/reports/${reportId}`
        : `/api/reports`;

      const responDatabase = await fetch(urlDatabase, {
        method: reportId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityName: dataForm.activityName,
          programId: dataForm.programId,
          lokasi: dataForm.lokasi,
          tanggalKegiatan: dataForm.tanggalKegiatan,
          picKegiatan: dataForm.picKegiatan,
          description: dataForm.description,
          uploadedPhotos: fotoBerhasilUpload, // untuk POST route
          photos: fotoBerhasilUpload, // untuk PUT route
        }),
      });

      const textRespon = await responDatabase.text();
      let hasilDatabase;
      try {
        hasilDatabase = JSON.parse(textRespon);
      } catch (e) {
        throw new Error(`Server returned non-JSON response: ${textRespon}`);
      }

      if (!responDatabase.ok) {
        console.error("Server error response:", hasilDatabase);
        throw new Error(hasilDatabase.message || "Gagal menyimpan ke database");
      }

      toast.success(
        reportId ? "Laporan berhasil diupdate!" : "Laporan berhasil dikirim!",
      );

      router.push("/pic/dashboard");
      resetStore();
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error) {
        toast.danger(error.message);
      } else {
        toast.danger("Terjadi kesalahan tidak terduga");
      }
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
