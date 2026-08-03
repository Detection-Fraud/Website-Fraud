import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kategori Program | Fraud Detection BULOG",
  description:
    "Kelola kategori program budaya yang akan digunakan dalam pelaporan kegiatan budaya.",
};

export default function CategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
