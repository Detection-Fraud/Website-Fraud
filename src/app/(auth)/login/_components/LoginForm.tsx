"use client";

import { loginAction } from "@/actions/login";
import {
  Button,
  Card,
  FieldError,
  Form,
  InputGroup,
  Label,
  Separator,
  Spinner,
  TextField,
  toast,
} from "@heroui/react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BsEye, BsEyeSlash } from "react-icons/bs";
import { CiCircleInfo, CiLock, CiLogin } from "react-icons/ci";
import { FaRegUser } from "react-icons/fa";

const SSO_ERROR_MESSAGES: Record<string, string> = {
  NotRegisteredPIC:
    "Akun Anda belum terdaftar sebagai PIC. Silakan hubungi Administrator.",
  SSOFailed: "Gagal memvalidasi SSO Bulog. Silakan coba lagi.",
  InvalidSAMLResponse: "Response SSO tidak valid. Silakan coba lagi.",
  MissingNIP:
    "NIP tidak ditemukan dari data SSO. Silakan hubungi Administrator.",
  InvalidSSOToken:
    "Token SSO tidak valid atau sudah expired. Silakan login ulang.",
  CSRFValidationFailed:
    "Sesi SSO tidak valid (CSRF). Silakan coba login ulang dari awal.",
  TokenAlreadyUsed:
    "Token SSO sudah digunakan. Silakan login ulang dari halaman utama.",
};

export default function LoginForm() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const ssoError = searchParams.get("error");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    startTransition(async () => {
      const response = await loginAction({
        username: data.username as string,
        password: data.password as string,
      });

      if (response?.error) {
        setErrorMessage(response.message || "Terjadi kesalahaan saat login.");
        toast.danger("Error", {
          description: response.message,
          indicator: <CiCircleInfo />,
        });
      } else if (!response?.error && (response?.data as any)?.redirectTo) {
        // Lakukan HARD RELOAD agar session NextAuth dan UI di layout ter-refresh secara sempurna
        window.location.href = (response.data as any).redirectTo;
      }
    });
  };

  const toggleVisibility = () => setIsVisible((prev) => !prev);

  return (
    <Card
      // 1. Terapkan Glassmorphism di sini (sama seperti Card Branding)
      className="p-8 md:p-8 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]"
      style={{
        borderRadius: "24px", // Gua halusin dikit lengkungannya biar matching sama kiri
      }}
    >
      <Card.Header>
        <Card.Title>
          <div className="w-full flex flex-col justify-center items-center">
            <div className="flex justify-center items-center bg-white/10 p-3 rounded-2xl border border-white/5">
              <Image
                // Pastikan pakai logo yang tulisannya putih kalau ada (logo-bulog-white.png)
                src="/assets/images/logo-bulog-white.png"
                width={100}
                height={100}
                className="object-contain"
                alt="Logo Bulog"
              />
            </div>
            <div className="mt-4">
              {/* 2. Ubah teks jadi putih */}
              <h1 className="md:text-2xl text-xl font-bold text-white text-center mb-1">
                Selamat Datang
              </h1>
            </div>
          </div>
        </Card.Title>
        {/* 3. Teks deskripsi jadi biru muda transparan */}
        <Card.Description className="text-blue-100/70 text-center mb-6">
          Silakan masuk ke akun Anda
        </Card.Description>
      </Card.Header>

      <Card.Content>
        {ssoError && SSO_ERROR_MESSAGES[ssoError] && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5">
            <CiCircleInfo className="text-red-400 text-lg mt-0.5 shrink-0" />
            <p className="text-red-300 text-sm">
              {SSO_ERROR_MESSAGES[ssoError]}
            </p>
          </div>
        )}
        <Form
          className="space-y-5"
          onSubmit={handleSubmit}
          validationBehavior="aria"
          method="post"
        >
          <TextField
            isRequired
            name="username"
            type="text"
            isDisabled={isPending}
          >
            {/* 4. Label harus terang */}
            <Label className="text-white/90 mb-1">Username</Label>
            {/* 5. Input Box gaya Glassmorphism */}
            <InputGroup className="bg-white/5 border border-white/20 text-white shadow-inner">
              <InputGroup.Prefix className="text-white/60">
                <FaRegUser />
              </InputGroup.Prefix>
              <InputGroup.Input
                placeholder="Masukkan Username"
                autoFocus
                className="bg-transparent text-white placeholder:text-white/40 outline-none"
              />
            </InputGroup>
            <FieldError className="text-red-400 mt-1" />
          </TextField>

          <TextField
            isRequired
            name="password"
            type="password"
            isDisabled={isPending}
          >
            <Label className="text-white/90 mb-1">Password</Label>
            <InputGroup className="bg-white/5 border border-white/20 text-white shadow-inner">
              <InputGroup.Prefix className="text-white/60">
                <CiLock />
              </InputGroup.Prefix>
              <InputGroup.Input
                placeholder="Masukkan Password"
                type={isVisible ? "text" : "password"}
                className="bg-transparent text-white placeholder:text-white/40 outline-none"
              />
              <InputGroup.Suffix>
                <button
                  type="button"
                  onClick={toggleVisibility}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  {isVisible ? <BsEyeSlash /> : <BsEye />}
                </button>
              </InputGroup.Suffix>
            </InputGroup>
            <FieldError className="text-red-400 mt-1" />
          </TextField>

          {/* Tombol Login Biru Solid biar menonjol */}
          <Button
            type="submit"
            fullWidth
            size="lg"
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg border-none font-semibold mt-2"
            isPending={isPending}
          >
            {!isPending && <CiLogin className="mr-2 text-xl" />}
            {isPending ? (
              <div className="flex items-center gap-2">
                <Spinner size="sm" className="text-white" />
                <span>Memeriksa...</span>
              </div>
            ) : (
              "Masuk"
            )}
          </Button>
        </Form>

        <div className="flex items-center justify-center gap-4 mt-8 mb-6">
          <Separator className="flex-1 bg-white/20" />
          <span className="text-sm text-white/50 font-medium">Atau</span>
          <Separator className="flex-1 bg-white/20" />
        </div>

        {/* Tombol SSO gaya outline kaca */}
        <Button
          fullWidth
          size="lg"
          variant="outline"
          className="border border-white/20 text-white bg-white/5 hover:bg-white/10 font-medium transition-all"
          onPress={() => {
            window.location.href = "/api/auth/sso/login";
          }}
        >
          <Image
            src="/assets/images/logo-bulog.png"
            width={20}
            height={20}
            className="object-contain mr-2"
            alt="Bulog"
          />
          Masuk dengan SSO
        </Button>
      </Card.Content>
    </Card>
  );
}
