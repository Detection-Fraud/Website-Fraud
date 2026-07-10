import { DashboardCharts, DashboardSummary } from "@/types/analytics.type";
import { Card, Chip, Link, ProgressBar, Tabs } from "@heroui/react";
import { BiAward, BiLineChart } from "react-icons/bi";
import { FiBarChart2 } from "react-icons/fi";
import { GoArrowUpRight, GoTrophy } from "react-icons/go";
import { LuMedal } from "react-icons/lu";
import { MdOutlineShield } from "react-icons/md";
import DashboardBarChart from "./BarChart";
import DashboardLineChart from "./LineChart";
import DashboardPieChart from "./PieChart";

interface ChartSectionProps {
  charts: DashboardCharts | null | undefined;
  summary: DashboardSummary | null | undefined;
}
export default function ChartSection({ charts, summary }: ChartSectionProps) {
  const rankIcon = (rank: number) =>
    rank === 1 ? (
      <GoTrophy className="w-4 h-4 text-yellow-500" />
    ) : rank === 2 ? (
      <LuMedal className="w-4 h-4 text-gray-400" />
    ) : rank === 3 ? (
      <BiAward className="w-4 h-4 text-orange-400" />
    ) : (
      <span className="text-sm font-bold text-gray-500">#{rank}</span>
    );
  return (
    <div className="space-y-8 mb-12">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        <Card className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl lg:col-span-3">
          {/* Tabs membungkus SELURUH isi Card */}
          <Tabs>
            {/* Baris Header: Title (kiri) + Tab Buttons (kanan) */}
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="font-bold text-gray-900">
                  Grafik Kegiatan per Bulan
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Jumlah laporan yang masuk setiap bulannya
                </p>
              </div>
              {/* Tab buttons di sini, sejajar dengan title */}
              <Tabs.ListContainer>
                <Tabs.List>
                  <Tabs.Tab
                    id={"bar"}
                    className="group data-[selected=true]:text-blue-600 text-gray-500"
                  >
                    <FiBarChart2 className="w-4 h-4 text-gray-400 group-data-[selected=true]:text-blue-600 transition-colors" />
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab
                    id={"line"}
                    className="group data-[selected=true]:text-blue-600 text-gray-500"
                  >
                    <BiLineChart className="w-4 h-4 text-gray-400 group-data-[selected=true]:text-blue-600 transition-colors" />
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

        <Card className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <Card.Header className="flex flex-row justify-between items-center">
            <div>
              <Card.Title className="font-bold text-gray-900">
                Top 5 Unit Teraktif
              </Card.Title>
              <Card.Description className="text-xs text-gray-400 mt-0.5">
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
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {unit.name}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-gray-900 ml-2">
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
            <p className="text-xs text-gray-400 mt-0.5">
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        <Card className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl lg:col-span-2">
          <Card.Header>
            <Card.Title className="font-bold text-gray-900">
              Distribusi Program
            </Card.Title>
            <Card.Description className="text-xs text-gray-400 mt-0.5">
              Presentase program budaya kegiatan
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <DashboardPieChart data={charts?.distribusiProgram} />
          </Card.Content>
        </Card>

        <Card className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl lg:col-span-3">
          <Card.Header className="flex flex-row justify-between items-center">
            <div>
              <Card.Title className="font-bold text-gray-900">
                Ranking Unit Kerja per Wilayah
              </Card.Title>
              <Card.Description className="text-xs text-gray-400 mt-0.5">
                Diurutkan berdasarkan tingkat persetujuan tertinggi
              </Card.Description>
            </div>
            <MdOutlineShield className="w-5 h-5 text-blue-500" />
          </Card.Header>

          <Card.Content className="space-y-6 pt-4">
            {charts?.rankingWilayah?.slice(0, 5).map((wilayah, index) => {
              // Progress bar menggunakan approvalRate langsung agar sinkron dengan angka yang ditampilkan

              // 2. Mapping warna sesuai data 'status' dari Backend
              let statusColor: "success" | "default" | "warning" | "danger" =
                "default";
              if (wilayah.status === "Sangat Baik") statusColor = "success";
              else if (wilayah.status === "Baik") statusColor = "default";
              else if (wilayah.status === "Cukup") statusColor = "warning";
              else if (wilayah.status === "Perlu Perhatian")
                statusColor = "danger";

              // Note: Untuk 'Trend', kita skip dulu karena perlu perhitungan historis
              // yang lebih rumit di backend. Untuk sekarang kita tampilkan persentase murni.

              return (
                <div key={wilayah.name} className="flex gap-4 items-start">
                  {/* Bagian Kiri: Ikon Ranking */}
                  <div className="w-8 pt-0.5 flex justify-center shrink-0">
                    {index === 0 ? (
                      <GoTrophy className="w-5 h-5 text-yellow-500" />
                    ) : index === 1 ? (
                      <LuMedal className="w-5 h-5 text-gray-400" />
                    ) : index === 2 ? (
                      <BiAward className="w-5 h-5 text-orange-400" />
                    ) : (
                      <span className="text-sm font-bold text-gray-500">
                        #{wilayah.rank}
                      </span>
                    )}
                  </div>

                  {/* Bagian Kanan: Konten Baris */}
                  <div className="flex-1 space-y-1.5">
                    {/* Baris Atas: Nama, Chip/Badge, dan Angka Persentase Asli */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">
                          {wilayah.name}
                        </span>
                        <Chip
                          size="sm"
                          color={statusColor as any}
                          variant="soft"
                          className="text-[10px] h-5 px-1 font-medium"
                        >
                          {wilayah.status}
                        </Chip>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                        {wilayah.approvalRate}%
                      </div>
                    </div>

                    {/* Baris Bawah: Progress Bar & Teks Detail Asli */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                      <div className="flex-1">
                        {/* Progress Bar diubah biar pake color bawaan Tailwind/Hex kalau HeroUI ngaco valuenya */}
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-blue-500`}
                            style={{ width: `${wilayah.approvalRate}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        {wilayah.kegiatan} kegiatan
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card.Content>

          <Card.Footer className="flex justify-center border-t border-gray-100 mt-4 pt-4 pb-0">
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
