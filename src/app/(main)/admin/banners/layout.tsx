import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Banner Program | Fraud Detection BULOG",
  description: "Kelola banner yang akan ditampilkan di halaman depan.",
};

export default function BannersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
