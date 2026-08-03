import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Master Program Budaya | Fraud Detection BULOG",
  description:
    "Kelola master data program budaya dan kriteria frekuensi target laporan.",
};

export default function ProgramsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
