import { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Management | Fraud Detection BULOG",
  description:
    "Kelola akun PIC unit kerja BULOG di seluruh Kanwil, Kancab, dan Divisi.",
};

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
