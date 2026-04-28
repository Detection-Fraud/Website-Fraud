"use client";

import { Avatar, Dropdown, Label } from "@heroui/react";
import { signOut } from "next-auth/react";
import { FaArrowRightToBracket } from "react-icons/fa6";

interface UserData {
  id?: string;
  name?: string | null;
  username?: string | null;
  role?: string;

  region?: {
    nama: string;
  } | null;
  branch?: {
    name: string;
  } | null;
  division?: {
    name: string;
  } | null;
}
export default function DropdownUser({ user }: { user: UserData | null }) {
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };
  if (!user) return null;
  return (
    <Dropdown>
      <Dropdown.Trigger>
        <div className="flex flex-row-reverse gap-4 items-center cursor-pointer">
          <Avatar>
            <Avatar.Fallback>
              {user?.name?.[0]?.toUpperCase()}
              {user?.name?.[1]?.toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
          <div className="md:flex flex-col gap-0 text-end hidden">
            <p className="text-sm leading-5 font-medium">{user?.name}</p>
            <p className="text-xs leading-none text-muted">
              {user?.role === "REGION"
                ? user?.region?.nama
                : user?.branch?.name || user?.division?.name}
            </p>
          </div>
        </div>
      </Dropdown.Trigger>
      <Dropdown.Popover className={"rounded-md shadow-xl"}>
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <Avatar.Fallback>
                {user?.name?.[0]?.toUpperCase()}
                {user?.name?.[1]?.toUpperCase()}
              </Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col gap-0">
              <p className="text-sm leading-5 font-medium">{user?.name}</p>
              <p className="text-xs leading-none text-muted">
                {user?.role === "REGION"
                  ? user?.region?.nama
                  : user?.branch?.name || user?.division?.name}
              </p>
            </div>
          </div>
        </div>

        <Dropdown.Menu>
          <Dropdown.Item
            id={"logout"}
            textValue={"Logout"}
            variant="danger"
            onPress={handleLogout}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <Label>Logout</Label>
              <FaArrowRightToBracket className="text-danger" />
            </div>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
