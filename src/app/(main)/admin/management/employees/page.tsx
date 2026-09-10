import { Metadata } from "next";
import EmployeeManagementView from "./_components/EmployeeManagementView";

export const metadata: Metadata = {
  title: "Manajemen Employee & User",
  description:
    "Administrasi data Employee dan akun User aplikasi dalam satu ruang Admin",
};

export default function EmployeeManagementPage() {
  return (
    <div className="h-full">
      <EmployeeManagementView />
    </div>
  );
}
