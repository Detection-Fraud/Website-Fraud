"use client";

import { useChangePassword } from "@/hooks/useChangePassword";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getDashboardByRole } from "@/lib/routes";
import {
  Button,
  Card,
  FieldError,
  Form,
  InputGroup,
  Label,
  Link,
  Separator,
  TextField,
  toast,
} from "@heroui/react";
import { useState } from "react";
import { BsEye, BsEyeSlash } from "react-icons/bs";
import { FiAlertTriangle } from "react-icons/fi";
import { IoIosArrowRoundBack } from "react-icons/io";
import { IoShieldCheckmarkOutline } from "react-icons/io5";
import { PiKey } from "react-icons/pi";

export default function FormChangePassword() {
  const { changePassword, isPending } = useChangePassword();
  const { user } = useCurrentUser();

  const isForcedToChange = () => {
    if (user?.authProvider !== "LOCAL") return false;

    if (!user.passwordChangedAt) return true;

    const daysSinceChange = Math.floor(
      (Date.now() - new Date(user.passwordChangedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return daysSinceChange > 90;
  };

  const showBackButton = !isForcedToChange();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      toast.danger("Validasi Gagal", {
        description: "Password baru dan konfirmasi password tidak cocok.",
      });
      return;
    }

    changePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });
  };
  return (
    <div>
      {showBackButton && (
        <div className="max-w-lg mx-auto mb-1.5">
          <Link href={getDashboardByRole(user?.role as string)}>
            <Link.Icon className="size-4 mr-1.5">
              <IoIosArrowRoundBack />
            </Link.Icon>
            Kembali
          </Link>
        </div>
      )}
      <Card className="w-full max-w-lg mx-auto my-auto space-y-6 py-8">
        {/* Warning alert */}
        {isForcedToChange() && (
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <FiAlertTriangle className="text-amber-500 text-xl shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-orange-700">
                Password wajib diperbaharui
              </h4>
              <p className="text-xs text-orange-600 leading-relaxed mt-0.5">
                Akses ke sistem akan dibatasi sampai password Anda diperbarui di
                portal
              </p>
            </div>
          </div>
        )}
        <Card.Header>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-linear-to-br from-[#1e2d6b] to-[#0284c7] rounded-2xl flex items-center justify-center">
              <PiKey className="w-5 h-5 text-white" />
            </div>
            <div>
              <Card.Title className="text-lg font-bold text-gray-800">
                Ubah Password
              </Card.Title>
              <Card.Description className="text-xs text-gray-500">
                {user?.name} - {user?.role}
              </Card.Description>
            </div>
          </div>
        </Card.Header>

        <Separator variant="secondary" />
        <Card.Content>
          <Form
            className="space-y-5"
            validationBehavior="aria"
            onSubmit={handleSubmit}
          >
            {/* PASSWORD LAMA */}
            <TextField
              isRequired
              name="currentPassword"
              type={showCurrent ? "text" : "password"}
            >
              <Label className="text-gray-700 text-xs font-semibold mb-1.5">
                Password Saat Ini
              </Label>
              <InputGroup
                className={
                  "bg-gray-50 border border-gray-200 hover:border-gray-300 focus-within:border-blue-500 focus-within:bg-white rounded-xl transition-all"
                }
              >
                <InputGroup.Input
                  placeholder="Masukkan password lama"
                  className={
                    "bg-transparent text-gray-800 placeholder:text-gray-400 outline-none w-full py-2.5 px-3.5 text-sm"
                  }
                />
                <InputGroup.Suffix className="pr-3">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onPress={() => setShowCurrent(!showCurrent)}
                    isPending={isPending}
                    isDisabled={isPending}
                  >
                    {showCurrent ? <BsEyeSlash /> : <BsEye />}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError className={"text-red-500 text-xs mt-1"} />
            </TextField>

            <div className="flex items-center gap-2">
              <Separator orientation="horizontal" className="flex-1" />
              <p className="text-xs font-semibold text-gray-700 ">
                PASSWORD BARU
              </p>
              <Separator orientation="horizontal" className="flex-1" />
            </div>
            {/* PASSWORD BARU */}
            <TextField
              isRequired
              name="newPassword"
              type={showNew ? "text" : "password"}
            >
              <Label className="text-gray-700 text-xs font-semibold mb-1.5">
                Password Baru
              </Label>
              <InputGroup
                className={
                  "bg-gray-50 border border-gray-200 hover:border-gray-300 focus-within:border-blue-500 focus-within:bg-white rounded-xl transition-all"
                }
              >
                <InputGroup.Input
                  placeholder="Masukkan password baru"
                  className={
                    "bg-transparent text-gray-800 placeholder:text-gray-400 outline-none w-full py-2.5 px-3.5 text-sm"
                  }
                />
                <InputGroup.Suffix className="pr-3">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onPress={() => setShowNew(!showNew)}
                  >
                    {showNew ? <BsEyeSlash /> : <BsEye />}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError className={"text-red-500 text-xs mt-1"} />
            </TextField>

            {/* CONFIRM NEW PASSWORD */}
            <TextField
              isRequired
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
            >
              <Label className="text-gray-700 text-xs font-semibold mb-1.5">
                Konfirmasi Password Baru
              </Label>
              <InputGroup
                className={
                  "bg-gray-50 border border-gray-200 hover:border-gray-300 focus-within:border-blue-500 focus-within:bg-white rounded-xl transition-all"
                }
              >
                <InputGroup.Input
                  placeholder="Masukkan konfirmasi password baru"
                  className={
                    "bg-transparent text-gray-800 placeholder:text-gray-400 outline-none w-full py-2.5 px-3.5 text-sm"
                  }
                />
                <InputGroup.Suffix className="pr-3">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onPress={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <BsEyeSlash /> : <BsEye />}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError className={"text-red-500 text-xs mt-1"} />
            </TextField>

            <Button
              type="submit"
              fullWidth
              className="bg-[#1b4f88] hover:bg-[#153e6b] text-white font-semibold rounded-xl py-6 shadow-md transition-all mt-4 border-none flex items-center justify-center gap-2"
            >
              <IoShieldCheckmarkOutline />
              Simpan Password Baru
            </Button>
          </Form>
        </Card.Content>
      </Card>
    </div>
  );
}
