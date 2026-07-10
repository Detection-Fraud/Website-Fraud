"use client";

import {
  SidebarMenuAdmin,
  SidebarMenuPIC,
} from "@/constants/sidebar.constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRejectedCount } from "@/hooks/useRejectedCount";
import { useLayoutStore } from "@/store/useLayoutStore";
import { Chip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const { isSidebarOpen, closeSidebar, setSidebarOpen } = useLayoutStore();

  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hindari hydration mismatch (Sidebar putih kosong)
  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Jika masuk mode mobile, otomatis tutup. Jika desktop, otomatis buka.
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };

    handleResize(); // Cek saat pertama kali diload
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarOpen]);

  // Auto-close sidebar saat klik menu (Hanya di Mobile)
  useEffect(() => {
    if (isMobile) {
      closeSidebar();
    }
  }, [pathname, closeSidebar, isMobile]);

  const { rejectedCount } = useRejectedCount(user?.role);

  const getMenuItems = () => {
    switch (user?.role) {
      case "ADMIN":
        return SidebarMenuAdmin;
      case "PIC":
        return SidebarMenuPIC;
      default:
        return [];
    }
  };

  // JANGAN render sidebar sebelum client siap untuk mencegah UI glitch/kosong
  if (!mounted) return null;

  return (
    <>
      {/* ═══ BACKDROP (Mobile Only) ═══ */}
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ═══ SIDEBAR CONTAINER ═══ */}
      <aside
        className={`
          z-50 h-screen bg-slate-900 border-slate-800
          transition-all duration-300 ease-in-out
          flex flex-col overflow-hidden
          ${isMobile ? "fixed top-0 left-0" : "static border-r"}
          ${
            isSidebarOpen
              ? "w-[260px] translate-x-0"
              : isMobile
                ? "w-[260px] -translate-x-full"
                : "w-0 border-r-0"
          }
        `}
      >
        <div className="w-[260px] min-w-[260px] h-full flex flex-col">
          {/* Logo */}
          <div className="px-4 py-6 flex items-center justify-center">
            <Image
              src="/assets/images/logo-bulog-white.png"
              width={100}
              height={100}
              alt="Logo Bulog"
              className="w-24"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto">
            {getMenuItems().map((item) => {
              const isDashboardRoot = [
                "/pic",
                "/admin/dashboard",
                "/viewer",
              ].includes(item.href);
              const isActive = isDashboardRoot
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex flex-row items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors
                    hover:bg-slate-800 hover:text-white
                    ${
                      isActive
                        ? "bg-blue-600/20 text-blue-400 border-r-2 border-blue-500"
                        : "text-slate-300"
                    }`}
                >
                  {item.icon}
                  <span className="font-semibold text-sm group-hover:text-white whitespace-nowrap flex-1">
                    {item.label}
                  </span>
                  {item.hasBadge && rejectedCount > 0 && (
                    <Chip color="danger" size="sm" variant="primary">
                      {rejectedCount > 99 ? "99+" : rejectedCount}
                    </Chip>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
