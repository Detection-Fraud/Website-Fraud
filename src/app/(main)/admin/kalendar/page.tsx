import { Metadata } from "next";
import AdminKalendarView from "./_components/AdminKalendarView";

export const metadata: Metadata = {
  title: "Kalender Kegiatan Budaya",
  description: "Jadwal dan pengingat kegiatan program budaya BULOG",
};

export default function KalendarPage() {
  return <AdminKalendarView />;
}
