"use client";

import { Card } from "@heroui/react";
import Image from "next/image";
import { BsEye, BsFileCheck, BsShield, BsUpcScan } from "react-icons/bs";
import LoginForm from "./_components/LoginForm";

export default function LoginPage() {
  return (
    // 1. Wadah utama: Pakai flex untuk menarik konten ke tengah vertikal & horizontal
    // Typo 'fles' udah diganti jadi 'flex'
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-linear-to-br from-slate-900 via-blue-900 to-slate-950 p-4 sm:p-8">
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>
      {/* Floating Shapes */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse" />
      <div
        className="absolute top-40 right-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-screen filter blur-3xl opacity-15 animate-pulse"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute -bottom-32 left-20 w-72 h-72 bg-indigo-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"
        style={{ animationDelay: "2s" }}
      />
      <div className="absolute top-10 right-1/4 opacity-5">
        <BsShield className="w-24 h-24 text-white" />
      </div>
      <div className="absolute bottom-20 left-1/4 opacity-5">
        <BsUpcScan className="w-32 h-32 text-white" />
      </div>
      <div className="absolute top-1/3 right-10 opacity-5">
        <BsEye className="w-20 h-20 text-white" />
      </div>
      <div className="absolute bottom-1/3 left-10 opacity-5">
        <BsFileCheck className="w-28 h-28 text-white" />
      </div>

      {/* --- MAIN CONTENT */}
      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-9">
        {/* BAGIAN KIRI: Branding */}
        <div className="hidden lg:flex items-center justify-center w-full">
          <Card
            className="flex flex-col justify-center p-6 lg:p-8 rounded-[32px] 
            bg-white/5 backdrop-blur-xl border border-white/10 w-full
            shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]"
          >
            <Card.Header className="w-full pb-0">
              <div className="flex items-center">
                <div className="bg-white/10 p-2 rounded-2xl backdrop-blur-sm border border-white/5">
                  <Image
                    src="/assets/images/logo-bulog-white.png"
                    width={80}
                    height={80}
                    className="object-contain"
                    alt="Logo Bulog"
                  />
                </div>
                <div className="ml-5">
                  <h1 className="text-2xl font-bold text-white drop-shadow-sm">
                    BULOG
                  </h1>
                  <h2 className="text-lg font-semibold text-blue-100 tracking-wide mt-1">
                    Aktivasi Budaya
                  </h2>
                </div>
              </div>
            </Card.Header>
            <Card.Content className="pt-6">
              <div className="space-y-4">
                <div className="w-12 h-1 bg-blue-500/50 rounded-full mb-4"></div>
                <h1 className="text-2xl font-bold leading-snug text-white/90">
                  Sistem Deteksi Keaslian Foto Kegiatan
                </h1>
                <p className="text-blue-100/70 text-base leading-relaxed font-light">
                  Teknologi AI canggih untuk memastikan integritas dan
                  autentisitas setiap dokumentasi kegiatan di lingkungan Perum
                  BULOG.
                </p>
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* BAGIAN KANAN: Login Form */}
        <div className="flex w-full items-center justify-center">
          <div className="w-full max-w-md">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
