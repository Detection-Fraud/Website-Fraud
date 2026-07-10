import Image from "next/image";
import { BsShieldCheck } from "react-icons/bs";
import { FiCheck } from "react-icons/fi";

export default function LeftPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 relative overflow-hidden bg-linear-to-br from-[#1e2d6b] via-[#0f1a45] to-[#0a1230] text-white">
      <div className="absolute top-0 left-0 w-80 h-80 rounded-full opacity-10 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,#0ea5e9,transparent)]" />

      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-10 translate-x-1/3 translate-y-1/3 bg-[radial-gradient(circle,#f97316,transparent)]" />

      <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full opacity-5 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,#fff,transparent)]" />
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/images/logo-bulog-white.png"
            width={50}
            height={50}
            className="object-contain bg-white/10 p-1.5 rounded-xl border border-white/10"
            alt="Logo Bulog"
          />
          <div>
            <h2 className="font-bold tracking-wider text-md leading-none ">
              BULOG
            </h2>
            <span className="text-xs text-blue-200/80">
              DICE (Digital Culture & Engagement Center)
            </span>
          </div>
        </div>
      </div>
      {/* Center Guide info */}
      <div className="relative z-10 my-auto space-y-6">
        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/15">
          <BsShieldCheck className="w-8 h-8 text-blue-200" />
        </div>

        <div className="space-y-2">
          <span className="inline-block  bg-amber-500/20 text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-500/30">
            Tindakan Diperlukan
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
            Perbarui <br />
            Password Anda
          </h1>
          <p className="text-sm text-blue-100/70 leading-relaxed font-light">
            Demi keamanan akun, Anda diwajibkan untuk memperbarui password
            sebelum dapat melanjutkan penggunaan sistem.
          </p>
        </div>
        {/* Checklist Syarat Password */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 text-sm text-blue-100/90">
            <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0 border border-emerald-500/30">
              <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span>Minimal 8 karakter</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-blue-100/90">
            <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0 border border-emerald-500/30">
              <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span>Kombinasi huruf besar & kecil</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-blue-100/90">
            <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0 border border-emerald-500/30">
              <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span>Sertakan angka atau simbol</span>
          </div>
        </div>
      </div>
      {/* Footer info */}
      <div className="relative z-10 text-xs text-blue-200/50">
        © {new Date().getFullYear()} BULOG - DICE (Digital Culture & Engagement
        Center)
      </div>
    </div>
  );
}
