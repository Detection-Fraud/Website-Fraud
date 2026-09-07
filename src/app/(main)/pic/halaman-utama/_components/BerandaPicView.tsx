"use client";

import {
  getImportantInformationError,
  usePicImportantInformation,
} from "@/hooks/useImportantInformation";
import {
  RecentActivity,
  usePicDashboard,
  type PicPeriodStatus,
} from "@/hooks/usePicDashboard";
import {
  Button,
  Card,
  Chip,
  Label,
  ListBox,
  Select,
  Skeleton,
} from "@heroui/react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import {
  FiAward,
  FiCheckCircle,
  FiClock,
  FiTarget,
  FiXCircle,
} from "react-icons/fi";
import { MdPendingActions } from "react-icons/md";
import BannerCarousel from "./BannerCarousel";
import ImportantInformationCarousel from "./ImportantInformationCarousel";

const PERIOD_STATUS_LABEL: Record<PicPeriodStatus, string> = {
  ACTIVITY_ACTIVE: "Sedang berjalan",
  UPLOAD_OPEN: "Masa upload",
  LATEST: "Periode terakhir",
};

function getComplianceColor(score: number) {
  if (score >= 75) {
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-500",
      icon: "text-emerald-500",
    };
  }
  if (score >= 50) {
    return {
      text: "text-blue-600",
      bg: "bg-blue-600",
      icon: "text-blue-500",
    };
  }
  if (score >= 25) {
    return {
      text: "text-amber-600",
      bg: "bg-amber-500",
      icon: "text-amber-500",
    };
  }
  return {
    text: "text-red-500",
    bg: "bg-red-500",
    icon: "text-red-400",
  };
}

export default function BerandaPicView() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedInput = selectedKey
    ? {
        year: Number(selectedKey.split("-")[0]),
        tw: Number(selectedKey.split("-")[1]),
      }
    : undefined;

  const { data, isLoading, isFetching, isError, refetch } =
    usePicDashboard(selectedInput);

  const {
    data: importantInfoData,
    isLoading: isImportantInfoLoading,
    isError: isImportantInfoError,
    error: importantInfoError,
    refetch: refetchImportantInfo,
  } = usePicImportantInformation();
  const importantInfoItems = importantInfoData?.items ?? [];

  const periods = data?.periods ?? [];
  const selectedPeriod = data?.selectedPeriod;
  const stats = data?.stats;
  const rank = data?.rank;
  const leaderboard = data?.leaderboard ?? [];
  const periodPrograms = data?.periodPrograms ?? [];
  const recentActivities = data?.recentActivities ?? [];

  const activeKey =
    selectedKey ??
    (selectedPeriod ? `${selectedPeriod.year}-${selectedPeriod.tw}` : "");

  const visualCompliance = Math.min(stats?.compliance ?? 0, 100);
  const colorTheme = getComplianceColor(visualCompliance);

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

  if (isError) {
    return (
      <Card className="border border-red-200 bg-red-50 shadow-none">
        <Card.Content className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="font-semibold text-red-800">Dashboard gagal dimuat</p>
          <p className="text-sm text-red-600">
            Periksa koneksi lalu coba muat kembali.
          </p>
          <Button variant="secondary" onPress={() => void refetch()}>
            Coba lagi
          </Button>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="inline-block w-1 h-6 rounded-full bg-linear-to-b from-blue-500 to-blue-700" />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Beranda PIC
            </h1>
          </div>
          <p className="ml-3 mt-0 flex flex-wrap items-center gap-2 text-slate-500">
            <span>Pantau kepatuhan dan performa kegiatan Anda.</span>
            {selectedPeriod ? (
              <>
                <span className="font-semibold text-blue-600">
                  {selectedPeriod.label}
                </span>
                <Chip size="sm" variant="secondary">
                  <Chip.Label>
                    {PERIOD_STATUS_LABEL[
                      selectedPeriod.status as PicPeriodStatus
                    ] ?? selectedPeriod.status}
                  </Chip.Label>
                </Chip>
              </>
            ) : null}
          </p>
        </div>

        {periods.length > 1 && (
          <div className="w-full sm:w-56">
            <Select
              aria-label="Pilih Periode Program"
              value={activeKey}
              onChange={(key) => setSelectedKey(key ? String(key) : null)}
              className="w-full"
            >
              <Label className="text-xs font-medium text-slate-600 mb-1">
                Periode Program {isFetching && "..."}
              </Label>
              <Select.Trigger className="min-h-11 bg-white border border-slate-200">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {periods.map((period: any) => (
                    <ListBox.Item
                      key={`${period.year}-${period.tw}`}
                      id={`${period.year}-${period.tw}`}
                      textValue={period.label}
                    >
                      {period.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        )}
      </header>

      {/* Section Informasi Penting (IPIC-14) */}
      <section
        aria-labelledby="informasi-penting-heading"
        className="space-y-3"
      >
        <h2
          id="informasi-penting-heading"
          className="text-base font-bold text-slate-800"
        >
          Informasi Penting
        </h2>

        {isImportantInfoLoading ? (
          <Card className="border border-slate-200 shadow-sm rounded-lg overflow-hidden bg-white p-0">
            <Skeleton className="aspect-2/1 w-full" />
          </Card>
        ) : isImportantInfoError ? (
          <Card className="border border-red-200 bg-red-50/50 shadow-sm rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-red-600 font-medium">
                {getImportantInformationError(importantInfoError).message}
              </p>
              <Button
                size="sm"
                variant="outline"
                onPress={() => void refetchImportantInfo()}
                className="shrink-0"
              >
                Coba lagi
              </Button>
            </div>
          </Card>
        ) : importantInfoItems.length === 0 ? (
          <Card className="border border-slate-200 shadow-sm rounded-lg bg-white p-8">
            <p className="text-center text-xs text-slate-400">
              Belum ada informasi penting yang ditampilkan saat ini.
            </p>
          </Card>
        ) : (
          <ImportantInformationCarousel items={importantInfoItems} />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* BENTO CELL 1 */}
        <div className="lg:col-span-8">
          <Card className="h-full border border-slate-200 shadow-sm rounded-lg">
            <Card.Content>
              <BannerCarousel programs={periodPrograms} />
            </Card.Content>
          </Card>
        </div>

        {/* BENTO CELL 2 */}
        <div className="lg:col-span-4">
          <Card className="h-full border border-slate-200 shadow-sm rounded-lg">
            <Card.Content className="p-6 flex flex-col justify-between">
              {selectedPeriod ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.15em]">
                        Kepatuhan Pada TW Ini
                      </h2>
                      <FiTarget className={colorTheme.icon} />
                    </div>

                    <div
                      className={`text-6xl font-black tracking-tighter mb-2 ${colorTheme.text}`}
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
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${colorTheme.bg}`}
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
                </>
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                  <FiTarget className="mb-3 size-8 text-slate-300" />
                  <p className="font-semibold text-slate-700">
                    Belum ada periode program
                  </p>
                  <p className="mt-1 max-w-xs text-sm text-slate-500">
                    Statistik akan tersedia setelah program budaya dibuat.
                  </p>
                </div>
              )}
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
                  recentActivities.map((act: RecentActivity, index: number) => (
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
                            className={`uppercase font-medium tracking-wide text-[10px]  ${
                              act.status === "APPROVED"
                                ? "text-emerald-600"
                                : act.status === "REJECTED"
                                  ? "text-red-600"
                                  : "text-amber-600"
                            }`}
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
                  leaderboard.map((pic, idx: number) => {
                    const picTheme = getComplianceColor(pic.compliance);
                    return (
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
                          <p className={`text-sm font-black ${picTheme.text}`}>
                            {pic.compliance}%
                          </p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
                            {pic.approved} Apprv
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
