import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kalender Program | Fraud Detection BULOG",
  description: "Kelola jadwal dan periode pelaksanaan program budaya.",
};

export default function KalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
