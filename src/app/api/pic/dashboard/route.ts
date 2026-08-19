import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user } = await requireAuth();
    if (user.role !== "PIC") throw new Error("Akses ditolak. Khusus PIC");

    const now = new Date();
    const currentTw = Math.ceil((now.getMonth() + 1) / 3);

    // TW quarter range: TW1=Jan-Mar, TW2=Apr-Jun, TW3=Jul-Sep, TW4=Oct-Dec
    const twStartMonth = (currentTw - 1) * 3; // 0-indexed
    const twStart = new Date(now.getFullYear(), twStartMonth, 1);
    const twEnd = new Date(now.getFullYear(), twStartMonth + 3, 0, 23, 59, 59);

    // Keep month range for personal stats only
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const activePrograms = await prisma.programBudaya.findMany({
      where: { isActive: true, tw: currentTw },
      select: {
        id: true,
        name: true,
        description: true,
        bannerUrl: true,
        frequency: true,
        startDate: true,
        endDate: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            bannerUrl: true,
            targetUnit: true,
          },
        },
      },
    });

    const twTarget = Math.max(
      1,
      activePrograms.reduce((sum, p) => sum + p.frequency, 0),
    );

    const statsRaw = await prisma.activityReport.groupBy({
      by: ["status"],
      where: {
        createdById: user.id,
        tanggalKegiatan: { gte: twStart, lte: twEnd },
      },
      _count: { id: true },
    });

    const getCount = (status: string) =>
      statsRaw.find((s) => s.status === status)?._count.id || 0;
    const approved = getCount("APPROVED");
    // LEBIH DARI > 100 %
    // const compliance =
    //   twTarget > 0 ? Number(((approved / twTarget) * 100).toFixed(1)) : 0;

    // fix compliance hanya = 100%
    const compliance =
      twTarget > 0
        ? Number((Math.min(approved / twTarget, 1) * 100).toFixed(1))
        : 0;

    const recentActivities = await prisma.activityReport.findMany({
      where: { createdById: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        tanggalKegiatan: true,
        createdAt: true,
        program: { select: { name: true } },
      },
    });

    const picApprovedCounts = await prisma.activityReport.groupBy({
      by: ["createdById"],
      where: {
        status: "APPROVED",
        tanggalKegiatan: { gte: twStart, lte: twEnd }, // full TW range
        createdBy: {
          role: "PIC",
        },
      },
      _count: { id: true },
    });

    const picIds = picApprovedCounts.map((p) => p.createdById!);
    const picUsers = picIds.length
      ? await prisma.user.findMany({
          where: { id: { in: picIds } },
          select: { id: true, name: true, unit: { select: { name: true } } },
        })
      : [];

    const allPicRanked = picApprovedCounts
      .map((p) => {
        const u = picUsers.find((user) => user.id === p.createdById);
        return {
          id: p.createdById!,
          name: u?.name || "Unknown",
          kancabName: u?.unit?.name || "Unit",
          approved: p._count.id,
          compliance: Number(
            (Math.min(p._count.id / twTarget, 1) * 100).toFixed(1),
          ),
          isMe: p.createdById === user.id,
        };
      })
      .sort((a, b) => b.compliance - a.compliance || b.approved - a.approved);

    const myRankIndex = allPicRanked.findIndex((l) => l.id === user.id);
    const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

    const leaderboard = allPicRanked.slice(0, 5);

    return NextResponse.json(
      successResponse(
        {
          currentTw,
          stats: {
            target: Math.round(twTarget),
            approved,
            pending: getCount("PENDING"),
            rejected: getCount("REJECTED"),
            compliance,
          },
          rank: { position: myRank, total: leaderboard.length },
          leaderboard,
          activePrograms,
          recentActivities,
        },
        "Berhasil",
      ),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/pic/dashboard");
  }
}
