"use client";

import { useParticipationReport } from "@/hooks/useParticipationReport";
import { useParticipationScore } from "@/hooks/useParticipationScore";
import type { ParticipationReportQuery } from "@/schemas/participation-report.schema";
import type { ParticipationReportRow } from "@/types/participation-report.types";
import { Button, Card, Chip, ListBox, Select, Spinner } from "@heroui/react";
import { useState } from "react";

const initialFilters: ParticipationReportQuery = {
  year: new Date().getFullYear(),
  participationType: "WITH_EVIDENCE",
  evidenceStatus: "ALL",
  scoreStatus: "ALL",
  kanwilId: "ALL",
  kancabId: "ALL",
  divisiId: "ALL",
  unitType: "NASIONAL",
  page: 1,
  limit: 10,
};

function statusLabel(status: ParticipationReportRow["status"]) {
  return {
    BELUM_UPLOAD: "Belum upload",
    PENDING: "Menunggu approval",
    REJECTED: "Ditolak",
    APPROVED_BELUM_DINILAI: "Approved, belum dinilai",
    SELESAI: "Selesai",
  }[status];
}

export default function ParticipationReportSection() {
  const [filters, setFilters] = useState(initialFilters);
  const [selectedReportId, setSelectedReportId] = useState("");
  const result = useParticipationReport(filters);
  const score = useParticipationScore(selectedReportId);
  const setFilter = <K extends keyof ParticipationReportQuery>(
    key: K,
    value: ParticipationReportQuery[K],
  ) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));

  return (
    <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-surface">
      <Card.Header className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Card.Title>Monitoring Evidence Partisipasi</Card.Title>
          <Card.Description>
            TOGA direct-admin per unit dan triwulan; score hanya terlihat oleh
            Admin.
          </Card.Description>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            aria-label="Filter status evidence"
            value={filters.evidenceStatus}
            onChange={(value) =>
              setFilter(
                "evidenceStatus",
                (value ?? "ALL") as ParticipationReportQuery["evidenceStatus"],
              )
            }
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {[
                  "ALL",
                  "BELUM_UPLOAD",
                  "PENDING",
                  "REJECTED",
                  "APPROVED_BELUM_DINILAI",
                  "SELESAI",
                ].map((value) => (
                  <ListBox.Item key={value} id={value} textValue={value}>
                    <ListBox.ItemIndicator />
                    {value}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Select
            aria-label="Filter status score"
            value={filters.scoreStatus}
            onChange={(value) =>
              setFilter(
                "scoreStatus",
                (value ?? "ALL") as ParticipationReportQuery["scoreStatus"],
              )
            }
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {["ALL", "BELUM_DINILAI", "SELESAI"].map((value) => (
                  <ListBox.Item key={value} id={value} textValue={value}>
                    <ListBox.ItemIndicator />
                    {value}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Select
            aria-label="Filter triwulan"
            value={filters.tw ? String(filters.tw) : "ALL"}
            onChange={(value) =>
              setFilter(
                "tw",
                value && value !== "ALL"
                  ? (Number(value) as 1 | 2 | 3 | 4)
                  : undefined,
              )
            }
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {["ALL", "1", "2", "3", "4"].map((value) => (
                  <ListBox.Item key={value} id={value} textValue={value}>
                    {value === "ALL" ? "Semua TW" : `TW ${value}`}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </Card.Header>
      <Card.Content className="space-y-3 px-4 pb-5">
        {result.isLoading ? (
          <div className="flex justify-center py-12" role="status">
            <Spinner />
            <span className="sr-only">Memuat monitoring</span>
          </div>
        ) : result.error ? (
          <div
            className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"
            role="alert"
          >
            <p>Monitoring tidak dapat dimuat: {result.error}</p>
            <Button
              className="bg-rose-100 text-rose-800 hover:bg-rose-200"
              onPress={() => result.refetch()}
            >
              Coba lagi
            </Button>
          </div>
        ) : result.rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Tidak ada data evidence untuk filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">
                Monitoring evidence partisipasi
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="p-3">Unit</th>
                  <th className="p-3">Kategori / TW</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Nilai</th>
                  <th className="p-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="p-3">
                      <span className="font-semibold text-slate-800">
                        {row.unit.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {row.unit.type}
                      </span>
                    </td>
                    <td className="p-3">
                      {row.category.name}
                      <span className="block text-xs text-slate-500">
                        TW {row.program.tw} · {row.program.year}
                      </span>
                    </td>
                    <td className="p-3">
                      <Chip
                        className="text-xs font-semibold"
                        color={
                          row.status === "SELESAI"
                            ? "success"
                            : row.status === "REJECTED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {statusLabel(row.status)}
                      </Chip>
                    </td>
                    <td className="p-3">
                      {row.score ? `${row.score.percentage}%` : "—"}
                    </td>
                    <td className="p-3">
                      {row.reportId ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => setSelectedReportId(row.reportId!)}
                        >
                          {row.status === "SELESAI"
                            ? "Lihat riwayat"
                            : "Isi nilai"}
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Belum ada evidence
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <Button
              isDisabled={filters.page <= 1 || result.isFetching}
              onPress={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page - 1,
                }))
              }
            >
              Sebelumnya
            </Button>
            <span className="text-xs text-slate-500">
              Halaman {filters.page} dari {result.pagination.totalPages}
            </span>
            <Button
              isDisabled={
                filters.page >= result.pagination.totalPages ||
                result.isFetching
              }
              onPress={() =>
                setFilters((current) => ({
                  ...current,
                  page: current.page + 1,
                }))
              }
            >
              Berikutnya
            </Button>
          </div>
        )}
        {selectedReportId && (
          <Card className="border border-sky-200 bg-sky-50">
            <Card.Header>
              <Card.Title className="text-sm">Detail score dan history</Card.Title>
            </Card.Header>
            <Card.Content>
              {score.isLoadingScore ? (
                <Spinner />
              ) : score.scoreData ? (
                <div className="space-y-2 text-sm">
                  <p>
                    Nilai saat ini:{" "}
                    <strong>
                      {score.scoreData.assessment?.percentage ?? "Belum dinilai"}
                      {score.scoreData.assessment?.percentage === 0
                        ? "%"
                        : score.scoreData.assessment?.percentage
                          ? "%"
                          : ""}
                    </strong>
                  </p>
                  <p>
                    Assessor:{" "}
                    {score.scoreData.assessment?.assessedBy?.name ?? "Belum ada"}
                  </p>
                  <p>
                    History:{" "}
                    {score.scoreData.assessment?.scoreHistories?.length ?? 0}{" "}
                    perubahan
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Belum ada nilai; aksi isi nilai tersedia dari approval/score
                  flow Admin.
                </p>
              )}
              <Button
                className="mt-3"
                variant="secondary"
                onPress={() => setSelectedReportId("")}
              >
                Tutup
              </Button>
            </Card.Content>
          </Card>
        )}
      </Card.Content>
    </Card>
  );
}
