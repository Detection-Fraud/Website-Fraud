"use client";

import { Avatar, Button, Dropdown, Label } from "@heroui/react";
import { signOut } from "next-auth/react";
import { FaArrowRightToBracket } from "react-icons/fa6";

interface UserData {
  name?: string | null;
  role?: string;
  regionName?: string | null;
  branchName?: string | null;
  divisionName?: string | null;
}

export default function DropdownUser({ user }: { user: UserData }) {
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  // Tampilkan nama wilayah/cabang/divisi (mana yang ada)
  const unitName = user.regionName || user.branchName || user.divisionName;

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <div role="button" tabIndex={0} className="flex flex-row-reverse gap-4 items-center cursor-pointer outline-none border-none bg-transparent">
          <Avatar>
            <Avatar.Fallback>
              {user?.name?.[0]?.toUpperCase()}
              {user?.name?.[1]?.toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
          <div className="md:flex flex-col gap-0 text-end hidden">
            <p className="text-sm leading-5 font-medium">{user?.name}</p>
            {unitName && (
              <p className="text-xs leading-none text-muted">{unitName}</p>
            )}
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
              {unitName && (
                <p className="text-xs leading-none text-muted">{unitName}</p>
              )}
            </div>
          </div>
        </div>

        <Dropdown.Menu aria-label="User actions">
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
