import { Metadata } from "next";
import BannersView from "./_components/BannersView";

export const metadata: Metadata = {
  title: "Banner Program ",
  description: "Kelola banner yang akan ditampilkan di halaman depan.",
};

export default function BannersPage() {
  return <BannersView />;
}
