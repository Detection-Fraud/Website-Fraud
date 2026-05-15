import AppBar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { ToastProvider } from "@heroui/react";
import type { ReactNode } from "react";

export default function ViewerLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppBar />

        <main className="flex-1 overflow-y-auto">
          <ToastProvider placement="top end" maxVisibleToasts={1} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-8 mt-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
