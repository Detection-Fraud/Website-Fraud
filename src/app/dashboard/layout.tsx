import AppBar from "@/components/layout/AppBar";
import type { ReactNode } from "react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div>
      <AppBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-20 mt-12">
        {children}
      </div>
    </div>
  );
}
