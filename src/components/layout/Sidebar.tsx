"use client";

import {
  SidebarMenuAdmin,
  SidebarMenuPIC,
} from "@/constants/sidebar.constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Label, ListBox } from "@heroui/react";
import { useLayoutStore } from "@/store/useLayoutStore";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const { user, isLoading } = useCurrentUser();
  const pathname = usePathname();

  const { isSidebarOpen } = useLayoutStore();

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
  return (
    <div className={`transition-all duration-300 ease-in-out border-r border-gray-200 hidden md:flex flex-col bg-slate-900 ${isSidebarOpen ? "w-[240px]" : "w-0 overflow-hidden border-r-0"}`}>
      <div className="px-3.5 py-7 space-y-3 min-w-[240px]">
        <div className="w-full flex items-center justify-center">
          <Image
            src={"/assets/images/logo-bulog-white.png"}
            width={100}
            height={100}
            alt="Logo Bulog"
            className="md:w-30 w-12 sm:w-16"
          />
        </div>
        <div className="">
          <ListBox className="text-white" items={getMenuItems()}>
            {(item) => {
              const isDashboardRoot = [
                "/pic",
                "/admin/dashboard",
                "/viewer",
              ].includes(item.href);
              const isActive = isDashboardRoot
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <ListBox.Item
                  key={item.key}
                  textValue={item.label}
                  href={item.href}
                  className={`hover:bg-slate-800 hover:text-white group rounded-md flex flex-row items-center justify-start gap-2 ${isActive ? "bg-blue-600/20 text-blue-400 border-r border-blue-500" : ""}`}
                >
                  <div className="flex flex-row items-start gap-2">
                    {item.icon}
                    <Label className="text-slate-300 font-semibold group-hover:text-white">
                      {item.label}
                    </Label>
                  </div>
                </ListBox.Item>
              );
            }}
          </ListBox>
        </div>
      </div>
    </div>
  );
}
