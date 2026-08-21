import { Metadata } from "next";
import ManagementUserView from "./_components/ManagementUserView";

export const metadata: Metadata = {
  title: "Manajemen Pengguna & PIC",
  description: "Kelola akun pengguna, hak akses, dan penugasan PIC unit kerja",
};

export default function ManagementPage() {
  return (
    <div className="h-full">
      <ManagementUserView />
    </div>
  );
}
