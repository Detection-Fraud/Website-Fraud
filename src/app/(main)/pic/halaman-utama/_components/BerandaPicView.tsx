"use client";

import { usePicDashboard } from "@/hooks/usePicDashboard";
import { Card, Chip, Skeleton } from "@heroui/react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  FiAward,
  FiCheckCircle,
  FiClock,
  FiTarget,
  FiXCircle,
} from "react-icons/fi";
import { MdPendingActions } from "react-icons/md";
import BannerCarousel from "./BannerCarousel";

const TW_LABELS = ["", "TW I", "TW II", "TW III", "TW IV"];

export default function BerandaPicView() {
  const { data, isLoading } = usePicDashboard();
  const {
    currentTw = 0,
    stats,
    rank,
    leaderboard = [],
    activePrograms = [],
    recentActivities = [],
  } = data ?? {};

  const visualCompliance = Math.min(stats?.compliance ?? 0, 100);

  if (isLoading) {
    return (
      <div className="p-6 max-w-350 mx-auto space-y-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-8 h-90 rounded-2xl" />
          <Skeleton className="lg:col-span-4 h-90 rounded-2xl" />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="inline-block w-1 h-6 rounded-full bg-linear-to-b from-blue-500 to-blue-700" />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Beranda PIC
            </h1>
          </div>
          <p className="text-slate-500 mt-0 ml-3">
            Pantau kepatuhan dan performa kegiatan Anda{" "}
            {currentTw ? (
              <span className="font-semibold text-blue-600">
                {TW_LABELS[currentTw]}
              </span>
            ) : (
              ""
            )}
            .
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* BENTO CELL 1 */}
        <div className="lg:col-span-8">
          <Card className="h-full border border-slate-200 shadow-sm rounded-lg">
            <Card.Content>
              <BannerCarousel programs={activePrograms} />
            </Card.Content>
          </Card>
        </div>

        {/* BENTO CELL 2 */}
        <div className="lg:col-span-4">
          <Card className="h-full border border-slate-200 shadow-sm rounded-lg">
            <Card.Content className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.15em]">
                    Kepatuhan TW Ini
                  </h2>
                  <FiTarget
                    className={
                      visualCompliance >= 75
                        ? "text-emerald-500"
                        : visualCompliance >= 50
                          ? "text-blue-500"
                          : visualCompliance >= 25
                            ? "text-amber-500"
                            : "text-red-400"
                    }
                  />
                </div>

                <div
                  className={`text-6xl font-black tracking-tighter mb-2 ${
                    visualCompliance >= 75
                      ? "text-emerald-600"
                      : visualCompliance >= 50
                        ? "text-blue-600"
                        : visualCompliance >= 25
                          ? "text-amber-600"
                          : "text-red-500"
                  }`}
                >
                  {stats?.compliance ?? 0}%
                </div>
                <p className="text-sm text-slate-500 mb-6 max-w-[28ch] leading-relaxed">
                  Telah disetujui{" "}
                  <span className="font-semibold text-slate-700">
                    {stats?.approved ?? 0}
                  </span>{" "}
                  dari target{" "}
                  <span className="font-semibold text-slate-700">
                    {stats?.target ?? 0}
                  </span>{" "}
                  kegiatan.
                </p>

                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-8">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      visualCompliance >= 75
                        ? "bg-emerald-500"
                        : visualCompliance >= 50
                          ? "bg-blue-600"
                          : visualCompliance >= 25
                            ? "bg-amber-500"
                            : "bg-red-500"
                    }`}
                    style={{ width: `${visualCompliance}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-amber-50/50 border border-amber-100 shadow-none">
                  <Card.Content>
                    <div className="text-amber-700 text-xs mb-1 font-semibold">
                      Menunggu
                    </div>
                    <div className="text-2xl font-bold text-amber-900 flex items-center gap-2">
                      {stats?.pending ?? 0}{" "}
                      <MdPendingActions className="text-amber-500 text-lg" />
                    </div>
                  </Card.Content>
                </Card>
                <Card className="bg-red-50/50 border border-red-100 shadow-none">
                  <Card.Content>
                    <div className="text-red-700 text-xs mb-1 font-semibold">
                      Ditolak
                    </div>
                    <div className="text-2xl font-bold text-red-900 flex items-center gap-2">
                      {stats?.rejected ?? 0}{" "}
                      <FiXCircle className="text-red-500 text-lg" />
                    </div>
                  </Card.Content>
                </Card>
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* BENTO CELL 3 */}
        <div className="lg:col-span-7">
          <Card className="h-full border border-slate-200 shadow-sm rounded-lg">
            <Card.Header className="flex flex-col items-start px-6 pt-6 pb-4 border-b border-slate-100 gap-1">
              <div className="flex items-center gap-2">
                <FiClock className="text-slate-400 size-4" />
                <h2 className="text-base font-bold text-slate-900">
                  Aktivitas Terakhir
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                {recentActivities.length} kegiatan terakhir yang Anda laporkan
              </p>
            </Card.Header>

            <Card.Content className="px-6 py-5">
              <div className="space-y-6">
                {recentActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <FiClock className="text-slate-200 size-8 mb-2" />
                    <p className="text-slate-400 text-sm">
                      Belum ada aktivitas dilaporkan.
                    </p>
                  </div>
                ) : (
                  recentActivities.map((act: any, index: number) => (
                    <div key={act.id} className="relative pl-8">
                      {/* Timeline Vertical Line */}
                      {index !== recentActivities.length - 1 && (
                        <div className="absolute left-2.75 top-7 -bottom-6 w-0.5 bg-slate-100 rounded-full" />
                      )}

                      {/* Status Icon Node */}
                      <div className="absolute left-0 top-0.5 z-10">
                        {act.status === "APPROVED" ? (
                          <div className="size-6 rounded-full bg-emerald-50 ring-2 ring-emerald-500 flex items-center justify-center">
                            <FiCheckCircle className="size-3.5 text-emerald-600" />
                          </div>
                        ) : act.status === "REJECTED" ? (
                          <div className="size-6 rounded-full bg-red-50 ring-2 ring-red-500 flex items-center justify-center">
                            <FiXCircle className="size-3.5 text-red-600" />
                          </div>
                        ) : (
                          <div className="size-6 rounded-full bg-amber-50 ring-2 ring-amber-400 flex items-center justify-center">
                            <MdPendingActions className="size-3.5 text-amber-600" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex flex-col min-w-0 pt-0.5 group">
                        <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {act.program?.name ?? "Program Tidak Diketahui"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          {format(
                            new Date(act.tanggalKegiatan),
                            "dd MMM yyyy",
                            { locale: id },
                          )}
                          <span className="text-slate-300">•</span>
                          <span
                            className={`uppercase font-medium tracking-wide text-[10px]  ${act.status === "APPROVED" ? "text-emerald-600" : act.status === "REJECTED" ? "text-red-600" : "text-amber-600"}`}
                          >
                            {act.status.toLowerCase()}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* BENTO CELL 4 */}

        <div className="lg:col-span-5">
          <Card className="h-full border border-slate-200 shadow-sm rounded-lg">
            <Card.Header className="flex items-center justify-between px-6 pt-6 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center size-7 rounded-lg bg-amber-100">
                  <FiAward className="text-amber-600 size-3.5" />
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Peringkat Nasional
                </h2>
              </div>
              {rank?.position ? (
                <Chip size="sm" className="bg-blue-600">
                  <FiAward className="size-3 text-white ml-1" />
                  <Chip.Label className="text-white font-bold">
                    #{rank.position}
                  </Chip.Label>
                </Chip>
              ) : null}
            </Card.Header>

            <Card.Content className="px-6 pb-6 pt-2 flex-1">
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FiAward className="text-slate-200 size-8 mb-2" />
                    <p className="text-slate-400 text-sm">
                      Belum ada data peringkat.
                    </p>
                  </div>
                ) : (
                  leaderboard.map((pic: any, idx: number) => (
                    <div
                      key={pic.id}
                      className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                        pic.isMe
                          ? "bg-blue-50 ring-1 ring-blue-200 shadow-sm"
                          : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center size-8 rounded-full text-xs font-black shrink-0 ${
                          idx === 0
                            ? "bg-amber-400 text-amber-950 shadow-sm"
                            : idx === 1
                              ? "bg-slate-300 text-slate-800 shadow-sm"
                              : idx === 2
                                ? "bg-orange-300/80 text-orange-950 shadow-sm"
                                : "bg-transparent text-slate-400"
                        }`}
                      >
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 flex items-center gap-2 min-w-0">
                          <span className="truncate">{pic.name}</span>
                          {pic.isMe && (
                            <Chip
                              size="sm"
                              className="h-4 bg-blue-100 px-1 shrink-0"
                            >
                              <Chip.Label className="text-[9px] uppercase tracking-widest font-bold text-blue-700">
                                Saya
                              </Chip.Label>
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {pic.kancabName}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-black ${
                            pic.compliance >= 75
                              ? "text-emerald-600"
                              : pic.compliance >= 50
                                ? "text-blue-600"
                                : pic.compliance >= 25
                                  ? "text-amber-600"
                                  : "text-red-500"
                          }`}
                        >
                          {pic.compliance}%
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
                          {pic.approved} Apprv
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
