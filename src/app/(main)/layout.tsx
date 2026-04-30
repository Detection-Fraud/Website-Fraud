import AppBar from "@/components/layout/Navbar";
import { ToastProvider } from "@heroui/react";
import type { ReactNode } from "react";

export default function ViewerLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div>
      <AppBar />
      <ToastProvider placement="top end" maxVisibleToasts={1} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-20 mt-12">
        {children}
      </div>
    </div>
  );
}
