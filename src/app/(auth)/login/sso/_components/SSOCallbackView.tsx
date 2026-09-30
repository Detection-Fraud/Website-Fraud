"use client";

import { Spinner } from "@heroui/react";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { signIn, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

export default function SSOCallbackView() {
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);
  const rejectedLogoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ redirectUrl?: unknown }>(
        "/auth/sso/logout/rejected/start",
      );
      if (typeof data?.redirectUrl !== "string" || !data.redirectUrl) {
        throw new Error("Invalid rejected SSO logout response");
      }
      return data.redirectUrl;
    },
  });

  useEffect(() => {
    if (hasRun.current) return;

    hasRun.current = true;
    handleSSOLogin();
  }, []);

  async function handleSSOLogin() {
    let bridgeTokenReceived = false;

    try {
      const res = await fetch("/api/auth/sso/token", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        setError(
          "Token SSO tidak valid atau sudah expired. Silakan login ulang.",
        );
        redirectToLogin("InvalidSSOToken");
        return;
      }

      const { token } = await res.json();

      if (typeof token !== "string" || !token) {
        setError("Token SSO tidak ditemukan.");
        redirectToLogin("InvalidSSOToken");
        return;
      }
      bridgeTokenReceived = true;

      const result = await signIn("sso-login", {
        token,
        redirect: false,
      });

      if (!result || result.error) {
        await rejectSSOAccess("Akses aplikasi ditolak. Mengakhiri sesi SSO...");
        return;
      }

      window.location.href = "/";
    } catch (err) {
      console.error("[SSO HANDLER] error: ", err);
      if (bridgeTokenReceived) {
        await rejectSSOAccess("Terjadi kesalahan saat memproses login SSO.");
      } else {
        setError("Terjadi kesalahan saat memvalidasi kredensial SSO.");
        redirectToLogin("SSOFailed");
      }
    }
  }

  async function rejectSSOAccess(message: string) {
    setError(message);

    try {
      await signOut({ redirect: false });
    } catch (err) {
      console.error("[SSO HANDLER] local sign-out failed: ", err);
    }

    try {
      const redirectUrl = await rejectedLogoutMutation.mutateAsync();
      window.location.href = redirectUrl;
    } catch (err) {
      console.error("[SSO HANDLER] rejected SSO logout failed: ", err);
      redirectToLogin("SSOAccessRejected", "failed");
    }
  }

  function redirectToLogin(errorCode: string, logoutStatus?: "failed") {
    setTimeout(() => {
      const query = new URLSearchParams({ error: errorCode });
      if (logoutStatus) query.set("logout", logoutStatus);
      window.location.href = `/login?${query.toString()}`;
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
          <Spinner size="sm" />
          <p className="text-blue-100/70 text-sm">
            Memproses kredensial SSO Anda, mohon tunggu...
          </p>
        </div>
      )}
    </div>
  );
}
