import { ToastProvider } from "@heroui/react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Masuk ke sistem pelaporan kegiatan budaya BULOG.",
};
export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <ToastProvider placement="top end" maxVisibleToasts={1} />
      {children}
    </div>
  );
}
