import type { Metadata } from "next";
import InformasiPentingView from "./_components/InformasiPentingView";

export const metadata: Metadata = {
  title: "Informasi Penting",
  description: "Kelola gambar informasi yang ditampilkan untuk seluruh PIC.",
};

export default function InformasiPentingPage() {
  return <InformasiPentingView />;
}
