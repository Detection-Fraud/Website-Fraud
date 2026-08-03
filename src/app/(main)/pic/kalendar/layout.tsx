import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kalender Kegiatan | Fraud Detection BULOG",
  description: "Jadwal dan pengingat kegiatan program budaya BULOG",
};

export default function KalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
