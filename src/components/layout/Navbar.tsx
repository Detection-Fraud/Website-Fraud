"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import Image from "next/image";
import DropdownUser, { UserData } from "./DropdownUser";
import { useLayoutStore } from "@/store/useLayoutStore";
import { Button } from "@heroui/react";
import { PiSidebarSimpleBold } from "react-icons/pi";

export default function Navbar() {
  const { user, isLoading } = useCurrentUser();
  const { toggleSidebar } = useLayoutStore();

  return (
    <header className="w-full shadow-sm shadow-slate-200 sticky top-0 z-50 border-b bg-white">
      <div className="max-w-7xl mx-auto flex items-center py-3 md:py-4 justify-between px-4 sm:px-6 lg:px-8 xl:px-20">
        <div className="flex flex-row gap-4">
          <Button
            isIconOnly
            variant="ghost"
            size="md"
            className={"rounded-lg"}
            onPress={toggleSidebar}
          >
            <PiSidebarSimpleBold />
          </Button>
          <div className="flex flex-col justify-center">
            <h1 className="text-sm sm:text-md md:text-xl font-bold text-gray-900 leading-tight">
              BULOG Fraud Detection
            </h1>
            <p className="text-xs text-gray-600 hidden md:block">
              Sistem Deteksi Keaslian Foto Kegiatan
            </p>
          </div>
        </div>
        <div>{!isLoading && user && <DropdownUser user={user as UserData} />}</div>
      </div>
    </header>
  );
}
