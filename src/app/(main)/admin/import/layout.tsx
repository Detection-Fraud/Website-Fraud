import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import Karyawan | Fraud Detection BULOG",
  description:
    "Kelola master data karyawan dengan mengupload file Excel/CSV.",
};

export default function ImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
