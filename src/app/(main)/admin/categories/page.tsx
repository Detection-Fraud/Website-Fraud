import { Metadata } from "next";
import CategoriesView from "./_components/CategoriesView";

export const metadata: Metadata = {
  title: "Kategori Program Budaya",
  description: "Master data kategori, warna tema, dan satuan pengukuran program budaya",
};

export default function AdminCategoriesPage() {
  return <CategoriesView />;
}
