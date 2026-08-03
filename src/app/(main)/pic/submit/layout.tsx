import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit Laporan | Fraud Detection BULOG",
  description:
    "Formulir pengajuan laporan kegiatan budaya baru dengan verifikasi AI fraud detection.",
};

export default function SubmitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
