"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLayoutStore } from "@/store/useLayoutStore";
import { Button } from "@heroui/react";
import { PiSidebarSimpleBold } from "react-icons/pi";
import DropdownUser, { UserData } from "./DropdownUser";

export default function Navbar() {
  const { user, isLoading } = useCurrentUser();
  const { toggleSidebar } = useLayoutStore();

  return (
    <header className="w-full shadow-sm shadow-slate-200 sticky top-0 z-30 border-b bg-white">
      <div className="w-full mx-auto flex items-center py-3 justify-between px-4 sm:px-6 lg:px-8">
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
            <h1 className="text-sm sm:text-base md:text-xl font-bold text-gray-900 leading-tight">
              DICE
            </h1>
            <p className="text-xs text-gray-600 hidden sm:block">
              Digital Culture & Engagement Center
            </p>
          </div>
        </div>
        <div>
          {!isLoading && user && <DropdownUser user={user as UserData} />}
        </div>
      </div>
    </header>
  );
}
