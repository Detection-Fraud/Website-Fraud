import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics & Monitoring | Fraud Detection BULOG",
  description:
    "Analisis grafik tren pelaporan, rangking wilayah/cabang/divisi, dan rasio kelayakan laporan.",
};

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
