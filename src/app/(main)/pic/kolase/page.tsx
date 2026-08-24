import { Metadata } from "next";
import PicCollageView from "./_components/PicCollageView";

export const metadata: Metadata = {
  title: "Kolase Foto PIC",
  description:
    "Galeri foto kegiatan budaya yang sudah disetujui untuk unit kerja PIC.",
};

export default function PicCollagePage() {
  return <PicCollageView />
}
