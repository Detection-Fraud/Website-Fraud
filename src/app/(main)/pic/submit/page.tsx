import { Metadata } from "next";
import SubmitDetectionView from "./_components/SubmitDetectionView";

export const metadata: Metadata = {
  title: "Upload Laporan Kegiatan",
  description:
    "Form pengajuan laporan kegiatan budaya dan deteksi duplikasi foto",
};

export default function DetectionPage() {
  return <SubmitDetectionView />;
}
