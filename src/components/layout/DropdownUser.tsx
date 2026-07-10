"use client";

import { getRoleLabel } from "@/lib/display-labels";
import { Avatar, Dropdown, Label } from "@heroui/react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CiLock } from "react-icons/ci";
import { FaArrowRightToBracket } from "react-icons/fa6";

export interface UserData {
  name?: string | null;
  role?: string;
  unitId?: string | null;
  unitName?: string | null;
  unitType?: string | null;
}

export default function DropdownUser({ user }: { user: UserData }) {
  const router = useRouter();
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  let unitName = "";

  if (user.unitType === "KANTOR_CABANG") {
    unitName = user.unitName || "Kantor Cabang";
  } else if (user.unitType === "KANTOR_WILAYAH") {
    unitName = user.unitName || "Kantor Wilayah";
  } else if (user.unitType === "DIVISI") {
    unitName = user.unitName || "Divisi";
  } else if (user.role === "ADMIN") {
    unitName = "Administrator Pusat";
  }

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <div
          role="button"
          tabIndex={0}
          className="flex flex-row-reverse gap-4 items-center cursor-pointer outline-none border-none bg-transparent"
        >
          <Avatar>
            <Avatar.Fallback>
              {user?.name?.[0]?.toUpperCase()}
              {user?.name?.[1]?.toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
          <div className="md:flex flex-col gap-0 text-end hidden">
            <p className="text-sm leading-5 font-medium">{user?.name}</p>
            <p className="text-xs leading-none text-muted">
              {getRoleLabel(user?.role || "")}
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
                {getRoleLabel(user?.role || "")}
              </p>
            </div>
          </div>
        </div>

        <Dropdown.Menu aria-label="User actions">
          <Dropdown.Item
            id={"change-password"}
            textValue="Ganti Password"
            onPress={() => {
              router.push("/settings/change-password");
            }}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <Label>Ganti Password</Label>
              <CiLock className="text-gray-500" />
            </div>
          </Dropdown.Item>
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
