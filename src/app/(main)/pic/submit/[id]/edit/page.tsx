import { Metadata } from "next";
import EditDetectionView from "./_components/EditDetectionView";

export const metadata: Metadata = {
  title: "Upload Ulang Foto Kegiatan",
  description: "Perbarui data laporan dan upload ulang foto kegiatan",
};

export default function EditDetectionPage() {
  return <EditDetectionView />;
}
