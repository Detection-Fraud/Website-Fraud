"use client";

import { Spinner } from "@heroui/react";
import { signIn } from "next-auth/react";
import { redirect } from "next/dist/server/api-utils";
import { useEffect, useRef, useState } from "react";

export default function SSOCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;

    hasRun.current = true;
    handleSSOLogin();
  }, []);

  async function handleSSOLogin() {
    try {
      const res = await fetch("/api/auth/sso/token", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));

        // Bedakan antara "token expired/missing" vs "token already used (replay)"
        if (res.status === 401) {
          const isReplay = body?.error?.includes("sudah digunakan");
          if (isReplay) {
            setError(
              "Token SSO sudah digunakan. Silakan login ulang melalui halaman utama.",
            );
            redirectToLogin("TokenAlreadyUsed");
          } else {
            setError(
              "Token SSO tidak valid atau sudah expired. Silakan login ulang.",
            );
            redirectToLogin("InvalidSSOToken");
          }
        } else {
          setError("Terjadi kesalahan saat mengambil token SSO.");
          redirectToLogin("SSOFailed");
        }
        return;
      }

      const { token } = await res.json();

      if (!token) {
        setError("Token SSO tidak ditemukan");
        redirectToLogin("InvalidSSOToken");
        return;
      }

      const result = await signIn("sso-login", {
        token,
        redirect: false,
      });

      if (result.error) {
        setError(
          "Akun anda belum terdaftar sebagai PIC. Silahkan hubungi Administrator",
        );
        redirectToLogin("NotRegisteredPIC");
        return;
      }

      window.location.href = "/";
    } catch (err) {
      console.error("[SSO HANDLER] error: ", err);
      setError("Terjadi kesalahan saat memproses login SSO.");
      redirectToLogin("SSOFailed");
    }
  }

  function redirectToLogin(errorCode: string) {
    setTimeout(() => {
      window.location.href = `/login?error=${errorCode}`;
    }, 2000);
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 bg-linear-to-br from-slate-900 via-blue-900 to-slate-950">
      {error ? (
        // Tampilan error
        <div className="text-center space-y-3 px-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-red-400 text-xl">✕</span>
          </div>
          <p className="text-red-300 text-sm max-w-md">{error}</p>
          <p className="text-white/40 text-xs">
            Mengalihkan ke halaman login...
          </p>
        </div>
      ) : (
        // Tampilan loading
        <div className="text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-blue-100/70 text-sm">
            Memproses kredensial SSO Anda, mohon tunggu...
          </p>
        </div>
      )}
    </div>
  );
}
