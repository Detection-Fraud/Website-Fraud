import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Laporan Kegiatan | Fraud Detection BULOG",
  description:
    "Daftar dan filter seluruh pengajuan kegiatan budaya yang diajukan PIC unit kerja.",
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
