import { Metadata } from "next";
import BerandaPicView from "./_components/BerandaPicView";

export const metadata: Metadata = {
  title: "Beranda PIC Budaya",
  description:
    "Ringkasan kepatuhan triwulanan, banner program aktif, dan leaderboard unit kerja",
};

export default function PagePic() {
  return <BerandaPicView />;
}
