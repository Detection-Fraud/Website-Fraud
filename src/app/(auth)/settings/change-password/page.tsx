import { Metadata } from "next";
import FormChangePassword from "./_components/FormChangePassword";
import LeftPanel from "./_components/LeftPanel";

export const metadata: Metadata = {
  title: "Ubah Password",
  description: "Pengaturan keamanan dan pembaruan kata sandi akun",
};

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      {/* LEFT PANEL */}
      <LeftPanel />

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16 relative overflow-y-auto">
        <FormChangePassword />
      </div>
    </div>
  );
}
