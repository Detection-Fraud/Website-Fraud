import { Metadata } from "next";
import PicKalendarView from "./_components/PicKalendarView";

export const metadata: Metadata = {
  title: "Kalender Kegiatan Budaya",
  description: "Jadwal dan pengingat kegiatan program budaya unit kerja Anda",
};

export default function KalendarPage() {
  return <PicKalendarView />;
}
