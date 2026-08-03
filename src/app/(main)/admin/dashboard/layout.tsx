import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard Admin | Fraud Detection BULOG",
  description:
    "Ringkasan statistik pelaporan kegiatan budaya dan monitoring kepatuhan unit kerja BULOG.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
