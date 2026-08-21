"use client";

import { useBanners } from "@/hooks/useBanners";
import Image from "next/image";
import { BsEye, BsFileCheck, BsShield, BsUpcScan } from "react-icons/bs";
import LoginCarousel from "./LoginCarousel";
import LoginForm from "./LoginForm";

export default function LoginView() {
  const { useGetBanners } = useBanners();
  const { data: banners = [] } = useGetBanners();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-linear-to-br from-slate-900 via-blue-950 to-slate-950 p-6 sm:p-10">
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.07) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(59, 130, 246, 0.07) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>
      {/* Floating Shapes */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-3xl opacity-15 animate-pulse pointer-events-none" />
      <div
        className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-pulse pointer-events-none"
        style={{ animationDelay: "1.5s" }}
      />
      <div className="absolute top-10 right-1/4 opacity-5 pointer-events-none">
        <BsShield className="w-24 h-24 text-white" />
      </div>
      <div className="absolute bottom-20 left-1/4 opacity-5 pointer-events-none">
        <BsUpcScan className="w-32 h-32 text-white" />
      </div>
      <div className="absolute top-1/3 right-10 opacity-5 pointer-events-none">
        <BsEye className="w-20 h-20 text-white" />
      </div>
      <div className="absolute bottom-1/3 left-10 opacity-5 pointer-events-none">
        <BsFileCheck className="w-28 h-28 text-white" />
      </div>

      {/* --- MAIN CONTENT: selalu grid 2 kolom di desktop --- */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        {/* ── KOLOM KIRI: Carousel atau Static Fallback (hidden di mobile) ── */}
        <div className="hidden lg:block">
          <LoginCarousel banners={banners} />
        </div>

        {/* ── KOLOM KANAN: Branding + Form ── */}

        <div className="flex flex-col gap-8">
          {/* Branding Header */}
          {banners.length > 0 && (
            <div className="flex flex-col gap-4">
              {/* Logo + Nama */}
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2.5 rounded-2xl border border-white/15 backdrop-blur-sm shrink-0">
                  <Image
                    src="/assets/images/logo-bulog-white.png"
                    width={32}
                    height={32}
                    alt="Logo Bulog"
                    className="object-contain"
                  />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-none">
                    Perum BULOG
                  </p>
                  <p className="text-blue-400 text-xs mt-0.5">DICE</p>
                </div>
              </div>

              {/* Tagline */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  Digital Culture &
                  <br />
                  Engagement Center
                </h1>
                <p className="text-blue-200/60 text-sm mt-3 leading-relaxed max-w-sm hidden sm:block">
                  Teknologi AI canggih untuk memastikan integritas dan
                  autentisitas setiap dokumentasi kegiatan di lingkungan Perum
                  BULOG.
                </p>
              </div>
            </div>
          )}

          {/* Login Form Card */}
          <LoginForm />

          {/* Mobile-only mini carousel */}
          {banners.length > 0 && (
            <div className="block lg:hidden">
              <LoginCarousel banners={banners} variant="compact" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
