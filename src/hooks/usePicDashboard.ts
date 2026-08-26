import { api } from "@/lib/api";
import type {
  PicDashboardPeriod,
  PicDashboardPeriodStatus,
} from "@/lib/program-period";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type PicPeriodStatus = PicDashboardPeriodStatus;
export type PicPeriod = PicDashboardPeriod;

export interface PicDashboardStats {
  target: number;
  approved: number;
  pending: number;
  rejected: number;
  compliance: number;
}

export interface LeaderboardItem {
  id: string;
  name: string;
  kancabName: string;
  approved: number;
  compliance: number;
  isMe: boolean;
}

export interface PeriodProgram {
  id: string;
  name: string;
  frequency: number;
  description: string | null;
  bannerUrl: string | null;
  startDate: string;
  endDate: string;
  uploadDeadline: string;
  isActive: boolean;
  category: {
    id: string;
    name: string;
    color: string | null;
    bannerUrl: string | null;
    targetUnit: string;
  } | null;
}

export interface RecentActivity {
  id: string;
  status: string;
  tanggalKegiatan: string;
  createdAt: string;
  program: { name: string } | null;
}

export interface PicDashboardData {
  periods: PicPeriod[];
  selectedPeriod: PicPeriod | null;
  stats: PicDashboardStats;
  rank: { position: number | null; total: number };
  leaderboard: LeaderboardItem[];
  periodPrograms: PeriodProgram[];
  recentActivities: RecentActivity[];
}

export function usePicDashboard(period?: { year: number; tw: number }) {
  return useQuery<PicDashboardData>({
    queryKey: ["pic-dashboard", period?.year ?? null, period?.tw ?? null],
    queryFn: () =>
      api
        .get("/pic/dashboard", { params: period })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });
}
