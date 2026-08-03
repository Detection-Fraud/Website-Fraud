import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Repository Laporan | Fraud Detection BULOG",
  description:
    "Daftar dan filter seluruh laporan kegiatan budaya yang diajukan PIC unit kerja.",
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
