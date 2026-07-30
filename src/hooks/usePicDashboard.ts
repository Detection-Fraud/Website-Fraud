import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

interface PicDashboardStats {
  target: number;
  approved: number;
  pending: number;
  rejected: number;
  compliance: number;
}

interface LeaderboardItem {
  id: string;
  name: string;
  kancabName: string;
  approved: number;
  compliance: number;
  isMe: boolean;
}

interface ActiveProgram {
  id: string;
  name: string;
  frequency: number;
  description: string | null;
  bannerUrl: string | null;
  startDate: string;
  endDate: string;
  category: {
    id: string;
    name: string;
    color: string | null;
    bannerUrl: string | null;
    targetUnit: string;
  } | null;
}

interface RecentActivity {
  id: string;
  status: string;
  tanggalKegiatan: string;
  createdAt: string;
  program: { name: string } | null;
}

interface PicDashboardData {
  currentTw: number;
  stats: PicDashboardStats;
  rank: { position: number; total: number };
  leaderboard: LeaderboardItem[];
  activePrograms: ActiveProgram[];
  recentActivities: RecentActivity[];
}

export function usePicDashboard() {
  return useQuery<PicDashboardData>({
    queryKey: ["pic-dashboard"],
    queryFn: () => api.get("/pic/dashboard").then((res) => res.data),
    staleTime: 2 * 60 * 1000,
  });
}
