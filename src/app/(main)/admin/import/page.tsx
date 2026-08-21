import { Metadata } from "next";
import ImportKaryawanView from "./_components/ImportKaryawanView";

export const metadata: Metadata = {
  title: "Import Data Karyawan",
  description:
    "Upload file Excel/CSV untuk menambahkan data karyawan secara massal ke database",
};

export default function ImportKaryawanPage() {
  return <ImportKaryawanView />;
}
