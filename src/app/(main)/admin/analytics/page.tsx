import { Metadata } from "next";
import AnalyticsView from "./_components/AnalyticsView";

export const metadata: Metadata = {
  title: "Analytics & Monitoring",
  description:
    "Analisis mendalam statistik kegiatan, tren partisipasi, dan ranking unit kerja",
};
export default function AnalyticsAdminPage() {
  return <AnalyticsView />;
}
