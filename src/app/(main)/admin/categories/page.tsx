"use client";
import AppBar from "@/components/layout/Appbar";
import SummaryCards from "@/components/ui/SummaryCard";
import { useCategories } from "@/hooks/useCategories";
import { BsCheck } from "react-icons/bs";
import { FiAlertTriangle } from "react-icons/fi";
import { IoBookOutline } from "react-icons/io5";
import { PiStack } from "react-icons/pi";

export default function CategoriesPage() {
  const { categories, loadingCategories, error, summary } = useCategories();

  const summaryCards = [
    {
      value: summary?.totalCategory ?? 0,
      description: "Total Kategori",
      icon: PiStack,
      style: "text-blue-600 bg-blue-100",
      textColor: "text-[#0284c7]",
    },
    {
      value: summary?.totalPrograms ?? 0,
      description: "Total Program",
      icon: IoBookOutline,
      style: "bg-green-100 text-green-600",
      textColor: "text-[#059669]",
    },
    {
      value: summary?.activePrograms ?? 0,
      icon: BsCheck,
      description: "Program Aktif",
      style: "bg-orange-100 text-orange-600",
      textColor: "text-[#d97706]",
    },
    {
      value: summary?.uncategorized ?? 0,
      icon: FiAlertTriangle,
      description: "Tidak Berkategori",
      style: "bg-red-100 text-red-600",
      textColor: "text-[#dc2626]",
    },
  ];

  return (
    <div className="space-y-6">
      <AppBar
        title="Kategori Program"
        description="Kelola kategori yang digunakan untuk mengklasifikasikan program budaya BULOG"
      />

      <div>
        <SummaryCards summary={summaryCards} />
      </div>
    </div>
  );
}
