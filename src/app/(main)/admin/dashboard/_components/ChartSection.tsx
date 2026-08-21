import { DashboardCharts, DashboardSummary } from "@/types/analytics.type";
import { Card, Chip, Link, ProgressBar, Tabs, Tooltip } from "@heroui/react";
import dynamic from "next/dynamic";
import { BiAward, BiLineChart } from "react-icons/bi";
import { FaUser } from "react-icons/fa";
import { FiBarChart2 } from "react-icons/fi";
import { GoArrowUpRight, GoTrophy } from "react-icons/go";
import { LuMedal } from "react-icons/lu";
import { MdOutlineShield } from "react-icons/md";

const ChartSkeleton = () => (
  <div className="h-64 w-full animate-pulse bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const DashboardBarChart = dynamic(() => import("./BarChart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

const DashboardLineChart = dynamic(() => import("./LineChart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

const DashboardPieChart = dynamic(() => import("./PieChart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

interface ChartSectionProps {
  charts: DashboardCharts | null | undefined;
  summary: DashboardSummary | null | undefined;
}
export default function ChartSection({ charts, summary }: ChartSectionProps) {
  const rankIcon = (rank: number) =>
    rank === 1 ? (
      <GoTrophy className="w-4 h-4 text-yellow-500" />
    ) : rank === 2 ? (
      <LuMedal className="w-4 h-4 text-slate-400" />
    ) : rank === 3 ? (
      <BiAward className="w-4 h-4 text-orange-400" />
    ) : (
      <span className="text-sm font-bold text-slate-500">#{rank}</span>
    );

  const statusColorMap: Record<
    string,
    "success" | "accent" | "warning" | "danger" | "default"
  > = {
    "Sangat Baik": "success", // Emerald / Green OKLCH
    Baik: "accent", // Royal / Sky Blue OKLCH
    Cukup: "warning", // Amber / Orange OKLCH
    "Perlu Perhatian": "danger", // Crimson / Red OKLCH
  };

  return (
    <div className="space-y-6 mb-12">
      {/* =========================================
          ROW 1: Grafik Kegiatan & Top 5 Unit
          ========================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        {/* CARD: GRAFIK KEGIATAN PER BULAN */}

        <Card className="p-6 bg-white border border-slate-200/60 shadow-[--surface-shadow] hover:shadow-(--surface-shadow-md) transition-all duration-200 rounded-2xl lg:col-span-3">
          {/* Tabs membungkus SELURUH isi Card */}
          <Tabs>
            {/* Baris Header: Title (kiri) + Tab Buttons (kanan) */}
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="font-bold text-slate-900">
                  Grafik Kegiatan per Bulan
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Jumlah laporan yang masuk setiap bulannya
                </p>
              </div>
              {/* Tab buttons di sini, sejajar dengan title */}
              <Tabs.ListContainer>
                <Tabs.List>
                  <Tabs.Tab
                    id={"bar"}
                    className="group data-[selected=true]:text-blue-600 text-slate-500"
                  >
                    <FiBarChart2 className="w-4 h-4 text-slate-400 group-data-[selected=true]:text-blue-600 transition-colors" />
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab
                    id={"line"}
                    className="group data-[selected=true]:text-blue-600 text-slate-500"
                  >
                    <BiLineChart className="w-4 h-4 text-slate-400 group-data-[selected=true]:text-blue-600 transition-colors" />
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </div>

            {/* Panel konten di BAWAH baris header */}
            <Tabs.Panel id={"bar"}>
              <DashboardBarChart data={charts?.kegiatanPerBulan} />
            </Tabs.Panel>
            <Tabs.Panel id={"line"}>
              <DashboardLineChart data={charts?.kegiatanPerBulan} />
            </Tabs.Panel>
          </Tabs>
        </Card>

        {/* CARD: TOP 5 UNIT TERAKTIF */}
        <Card className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl lg:col-span-2">
          <Card.Header className="flex flex-row justify-between items-center">
            <div>
              <Card.Title className="font-bold text-slate-900">
                Top 5 Unit Teraktif
              </Card.Title>
              <Card.Description className="text-xs text-slate-400 mt-0.5">
                Berdasarkan jumlah kegiatan
              </Card.Description>
            </div>
            <GoTrophy className="w-5 h-5 text-yellow-400" />
          </Card.Header>

          <Card.Content className="space-y-4">
            {charts?.topUnit.slice(0, 5).map((unit, index) => {
              const maxJumlah = charts?.topUnit?.[0]?.jumlah || 1;
              const percentage = (unit.jumlah / maxJumlah) * 100;

              return (
                <div key={unit.name} className="flex items-center gap-3">
                  <div className="w-7 shrink-0 flex items-center justify-center">
                    {rankIcon(index + 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {unit.name}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-slate-900 ml-2">
                        {unit.jumlah}
                      </span>
                    </div>
                    <ProgressBar value={percentage} color="success">
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  </div>
                </div>
              );
            })}
          </Card.Content>

          <Card.Footer className="flex flex-row justify-between items-center">
            <p className="text-xs text-slate-400 mt-0.5">
              Total Unit : {summary?.totalUnitAktif}
            </p>
            <Link
              href={"/admin/analytics"}
              className={
                "text-xs text-blue-600 font-medium no-underline hover:underline"
              }
            >
              Lihat Semua
              <Link.Icon>
                <GoArrowUpRight />
              </Link.Icon>
            </Link>
          </Card.Footer>
        </Card>
      </div>

      {/* =========================================
          ROW 2: Distribusi Program & Ranking Wilayah
          ========================================= */}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        {/* CARD: DISTRIBUSI PROGRAM */}

        <Card className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl lg:col-span-2">
          <Card.Header>
            <Card.Title className="font-bold text-slate-900">
              Distribusi Program
            </Card.Title>
            <Card.Description className="text-xs text-slate-400 mt-0.5">
              Presentase program budaya kegiatan
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <DashboardPieChart data={charts?.distribusiProgram} />
          </Card.Content>
        </Card>

        {/* CARD: RANKING UNIT KERJA PER WILAYAH */}
        <Card className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl lg:col-span-3">
          <Card.Header className="flex flex-row justify-between items-center">
            <div>
              <Card.Title className="font-bold text-slate-900">
                Ranking Unit Kerja per Wilayah
              </Card.Title>
              <Card.Description className="text-xs text-slate-400 mt-0.5">
                Diurutkan berdasarkan tingkat persetujuan tertinggi
              </Card.Description>
            </div>
            <MdOutlineShield className="w-5 h-5 text-blue-500" />
          </Card.Header>

          <Card.Content className="space-y-6 pt-4">
            {charts?.rankingWilayah?.slice(0, 5).map((wilayah, index) => {
              return (
                <div key={wilayah.name} className="flex gap-4 items-start">
                  {/* Bagian Kiri: Ikon Ranking (UPDATED: reused rankIcon helper) */}
                  <div className="w-8 pt-0.5 flex justify-center shrink-0">
                    {rankIcon(index + 1)}
                  </div>

                  {/* Bagian Kanan: Konten Baris */}
                  <div className="flex-1 space-y-1.5">
                    {/* Baris Atas: Nama, Chip/Badge, dan Angka Persentase Asli */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {/* UPDATED: text-gray-900 -> text-slate-900 */}
                        <span className="font-semibold text-sm text-slate-900">
                          {wilayah.name}
                        </span>
                        {/* UPDATED: Reused statusColorMap */}
                        <Chip
                          size="sm"
                          color={statusColorMap[wilayah.status] || "default"}
                          variant="soft"
                          className="text-[10px] h-5 px-1 font-medium"
                        >
                          {wilayah.status}
                        </Chip>
                      </div>
                      <div className="text-sm font-bold text-slate-900 ml-2 tabular-nums">
                        {wilayah.approvalRate}%
                      </div>
                    </div>

                    {/* Baris Bawah: Progress Bar & Teks Detail Asli */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                      <div className="flex-1">
                        {/* UPDATED: bg-gray-100 -> bg-slate-100 */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-blue-600 transition-all duration-500 ease-out`}
                            style={{ width: `${wilayah.approvalRate}%` }}
                          />
                        </div>
                      </div>
                      {/* UPDATED: text-gray-400 -> text-slate-400 */}
                      <div className="text-[11px] text-slate-400 font-medium tabular-nums">
                        {wilayah.kegiatan} kegiatan
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card.Content>

          <Card.Footer className="flex justify-center border-t border-slate-100 mt-4 pt-4 pb-0">
            <Link
              href="/admin/analytics"
              className={
                "text-xs text-blue-600 font-medium hover:underline no-underline"
              }
            >
              Lihat ranking lengkap ↗
            </Link>
          </Card.Footer>
        </Card>
      </div>

      {/* ROW 3 TOP 10 CC */}
      <div>
        <Card className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl lg:col-span-3 lg:col-start-2">
          <Card.Header className="flex flex-row justify-between items-center">
            <div>
              <Card.Title className="font-bold text-slate-900">
                Top 10 Culture Catalyst
              </Card.Title>
              <Card.Description className="text-xs text-slate-400 mt-0.5">
                Culture Catalyst dengan performa approval terbaik
              </Card.Description>
            </div>
            <FaUser className="w-4 h-4 text-blue-500" />
          </Card.Header>

          <Card.Content
            className="space-y-4 pt-4
          "
          >
            {charts?.rankingCC && charts.rankingCC.length > 0 ? (
              charts.rankingCC.slice(0, 10).map((cc, index) => {
                return (
                  <div key={cc.userId} className="flex gap-4 items-start py-1">
                    {/* Ranking Icon */}
                    <div className="w-8 pt-0.5 flex justify-center shrink-0">
                      {rankIcon(index + 1)}
                    </div>

                    <div className="flex-1 space-y-2">
                      {/* Nama & Chip */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-[10px] font-bold">
                            {cc.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-sm text-slate-900">
                            {cc.name}
                          </span>
                          <Chip
                            size="sm"
                            color={statusColorMap[cc.status] || "default"}
                            variant="soft"
                            className="text-[10px] h-5 px-1.5 font-medium border-none"
                          >
                            {cc.status}
                          </Chip>
                        </div>
                        <div className="flex items-center text-sm font-bold text-slate-900 tabular-nums">
                          {cc.approved}{" "}
                          <span className="text-slate-400 font-normal ml-1 text-xs">
                            / {cc.target} Target
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar & Unit Info */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all duration-500"
                            style={{
                              width: `${Math.min(cc.approvalRate, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium whitespace-nowrap w-24 text-right truncate">
                          <Tooltip>
                            <Tooltip.Trigger>{cc.unitName}</Tooltip.Trigger>
                            <Tooltip.Content>{cc.unitName}</Tooltip.Content>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                Tidak ada data Culture Catalyst
              </div>
            )}
          </Card.Content>
          <Card.Footer className="flex justify-center border-t border-slate-100 mt-4 pt-4 pb-0">
            <Link
              href="/admin/analytics"
              className={
                "text-xs text-blue-600 font-medium hover:underline no-underline"
              }
            >
              Lihat ranking lengkap ↗
            </Link>
          </Card.Footer>
        </Card>
      </div>
    </div>
  );
}
