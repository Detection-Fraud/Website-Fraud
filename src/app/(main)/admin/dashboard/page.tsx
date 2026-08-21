import { Metadata } from "next";
import DashboardView from "./_components/DashboardView";

export const metadata: Metadata = {
  title: "Dashboard Admin",
  description:
    "Ringkasan statistik pelaporan kegiatan budaya dan monitoring kepatuhan unit kerja BULOG.",
};

export default function DashboardAdminPage() {
  return <DashboardView />;
}
