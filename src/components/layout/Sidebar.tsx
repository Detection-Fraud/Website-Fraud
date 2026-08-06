"use client";

import {
  SidebarMenuAdmin,
  SidebarMenuItem,
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
import { PiCaretDownBold } from "react-icons/pi";

export default function Sidebar() {
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const { isSidebarOpen, closeSidebar, setSidebarOpen } = useLayoutStore();

  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Hindari hydration mismatch (Sidebar putih kosong)
  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarOpen]);

  // Auto-close sidebar saat klik menu (Hanya di Mobile)
  useEffect(() => {
    if (isMobile) {
      closeSidebar();
    }
  }, [pathname, closeSidebar, isMobile]);

  // Auto-open submenu jika salah satu child sedang aktif
  useEffect(() => {
    if (!mounted) return;
    const newOpenMenus: Record<string, boolean> = {};
    getMenuItems().forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) =>
          pathname.startsWith(child.href),
        );
        if (hasActiveChild) {
          newOpenMenus[item.key] = true;
        }
      }
    });
    setOpenMenus(newOpenMenus);
  }, [pathname, mounted]);

  const { rejectedCount } = useRejectedCount(user?.role);

  const getMenuItems = (): SidebarMenuItem[] => {
    switch (user?.role) {
      case "ADMIN":
        return SidebarMenuAdmin;
      case "PIC":
        return SidebarMenuPIC;
      default:
        return [];
    }
  };

  const isParentActive = (item: SidebarMenuItem): boolean => {
    if (!item.children) return false;
    return item.children.some((child) => pathname.startsWith(child.href));
  };

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
              ? "w-65 translate-x-0"
              : isMobile
                ? "w-65 -translate-x-full"
                : "w-0 border-r-0"
          }
        `}
      >
        <div className="w-65 min-w-65 h-full flex flex-col">
          {/* Logo */}
          <div className="px-4 py-6 flex items-center justify-start">
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
              // ─── CASE 1: Menu dengan Submenu ───────────────────────────
              if (item.children && item.children.length > 0) {
                const isOpen = openMenus[item.key] ?? false;
                const isActive = isParentActive(item);

                return (
                  <div key={item.key}>
                    <button
                      onClick={() => toggleMenu(item.key)}
                      className={`w-full flex flex-row items-center gap-3 px-3 py-2.5 rounded-lg group transition-all duration-200
                        hover:bg-slate-800 hover:text-white
                        ${
                          isActive
                            ? "bg-blue-600/15 text-blue-300 font-bold border-l-[3px] border-blue-400 shadow-[inset_0_0_12px_rgba(59,130,246,0.1)]"
                            : "text-slate-300"
                        }`}
                    >
                      {item.icon}
                      <span className="font-semibold text-sm group-hover:text-white whitespace-nowrap flex-1 text-left">
                        {item.label}
                      </span>
                      <PiCaretDownBold
                        className={`text-xs transition-transform duration-200 ${
                          isOpen ? "rotate-180" : "rotate-0"
                        }`}
                      />
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-200 ease-in-out ${
                        isOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 pl-3 pt-1 pb-1">
                        {item.children.map((child) => {
                          const isChildActive = pathname.startsWith(child.href);
                          return (
                            <Link
                              key={child.key}
                              href={child.href}
                              className={`flex flex-row items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150
                                hover:bg-slate-800 hover:text-white
                                ${
                                  isChildActive
                                    ? "text-blue-300 font-medium bg-blue-600/15"
                                    : "text-slate-400"
                                }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isChildActive ? "bg-blue-400" : "bg-slate-600"
                                }`}
                              />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              // ─── CASE 2: Menu Biasa ─────────────────────────────────────
              const isDashboardRoot = [
                "/pic",
                "/admin/dashboard",
                "/viewer",
              ].includes(item.href ?? "");
              const isActive = isDashboardRoot
                ? pathname === item.href
                : item.href
                  ? pathname.startsWith(item.href)
                  : false;

              return (
                <Link
                  key={item.key}
                  href={item.href ?? "#"}
                  className={`flex flex-row items-center gap-3 px-3 py-2.5 rounded-lg group transition-all duration-200
                    hover:bg-slate-800 hover:text-white
                    ${
                      isActive
                        ? "bg-blue-600/15 text-blue-300 font-bold border-l-[3px] border-blue-400 shadow-[inset_0_0_12px_rgba(59,130,246,0.1)]"
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
