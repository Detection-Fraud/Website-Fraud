import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  programYearBounds,
  resolvePicDashboardPeriods,
  startOfLocalDay,
} from "@/lib/program-period";
import { successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth();
    if (user.role !== "PIC") throw new Error("Akses ditolak. Khusus PIC");

    const today = startOfLocalDay(new Date());
    const requestedYear = Number(request.nextUrl.searchParams.get("year"));
    const requestedTw = Number(request.nextUrl.searchParams.get("tw"));

    // 1. Ambil periode terbuka + aktivitas terakhir
    const [currentWindowPrograms, recentActivities] = await Promise.all([
      prisma.programBudaya.findMany({
        where: {
          tw: { not: null },
          startDate: { lte: today },
          uploadDeadline: { gte: today },
        },
        select: {
          isActive: true,
          tw: true,
          startDate: true,
          endDate: true,
          uploadDeadline: true,
        },
      }),
      prisma.activityReport.findMany({
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
      }),
    ]);

    const openPrograms = currentWindowPrograms.filter(
      (program) => program.isActive,
    );
    const fallbackProgram =
      currentWindowPrograms.length === 0
        ? await prisma.programBudaya.findFirst({
            where: {
              tw: { not: null },
              uploadDeadline: { lt: today },
            },
            orderBy: [{ startDate: "desc" }, { updatedAt: "desc" }],
            select: {
              tw: true,
              startDate: true,
              endDate: true,
              uploadDeadline: true,
            },
          })
        : null;

    const requested =
      Number.isInteger(requestedYear) &&
      requestedYear > 0 &&
      Number.isInteger(requestedTw) &&
      requestedTw >= 1 &&
      requestedTw <= 4
        ? { year: requestedYear, tw: requestedTw }
        : undefined;

    // 2. Resolve daftar periode dan periode terpilih
    const { periods, selectedPeriod } = resolvePicDashboardPeriods({
      openPrograms,
      fallbackProgram,
      hasCurrentWindow: currentWindowPrograms.length > 0,
      requested,
      now: today,
    });

    if (!selectedPeriod) {
      return NextResponse.json(
        successResponse(
          {
            periods: [],
            selectedPeriod: null,
            stats: {
              target: 0,
              approved: 0,
              pending: 0,
              rejected: 0,
              compliance: 0,
            },
            rank: { position: null, total: 0 },
            leaderboard: [],
            periodPrograms: [],
            recentActivities,
          },
          "Belum ada data program budaya",
        ),
      );
    }

    // 3. Ambil seluruh program di periode terpilih
    const allPeriodPrograms = await prisma.programBudaya.findMany({
      where: {
        tw: selectedPeriod.tw,
        startDate: programYearBounds(selectedPeriod.year),
      },
      select: {
        id: true,
        name: true,
        description: true,
        bannerUrl: true,
        frequency: true,
        startDate: true,
        endDate: true,
        uploadDeadline: true,
        isActive: true,
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
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
    });

    // Carousel HANYA menampilkan program yang aktif
    const periodPrograms = allPeriodPrograms.filter((p) => p.isActive);

    // Metrik kepatuhan menghitung SEMUA program pada periode tersebut (termasuk yang nonaktif)
    const programIds = allPeriodPrograms.map((program) => program.id);
    const target = allPeriodPrograms.reduce(
      (sum, program) => sum + program.frequency,
      0,
    );
    const reportScope = { programId: { in: programIds } };

    // 4. Hitung stats dan leaderboard
    const [statsRaw, picApprovedCounts] = await Promise.all([
      prisma.activityReport.groupBy({
        by: ["status"],
        where: { createdById: user.id, ...reportScope },
        _count: { id: true },
      }),
      prisma.activityReport.groupBy({
        by: ["createdById"],
        where: {
          status: "APPROVED",
          createdById: { not: null },
          createdBy: { role: "PIC" },
          ...reportScope,
        },
        _count: { id: true },
      }),
    ]);

    const count = (status: "APPROVED" | "PENDING" | "REJECTED") =>
      statsRaw.find((item) => item.status === status)?._count.id ?? 0;
    const approved = count("APPROVED");
    const compliance =
      target > 0
        ? Number((Math.min(approved / target, 1) * 100).toFixed(1))
        : 0;

    const picIds = picApprovedCounts.flatMap((item) =>
      item.createdById ? [item.createdById] : [],
    );
    const picUsers = picIds.length
      ? await prisma.user.findMany({
          where: { id: { in: picIds } },
          select: { id: true, name: true, unit: { select: { name: true } } },
        })
      : [];
    const userMap = new Map(picUsers.map((item) => [item.id, item]));

    const allRanked = picApprovedCounts
      .map((item) => {
        const pic = userMap.get(item.createdById!);
        return {
          id: item.createdById!,
          name: pic?.name ?? "Unknown",
          kancabName: pic?.unit?.name ?? "Unit",
          approved: item._count.id,
          compliance:
            target > 0
              ? Number((Math.min(item._count.id / target, 1) * 100).toFixed(1))
              : 0,
          isMe: item.createdById === user.id,
        };
      })
      .sort((a, b) => b.compliance - a.compliance || b.approved - a.approved);

    const myIndex = allRanked.findIndex((item) => item.id === user.id);

    return NextResponse.json(
      successResponse(
        {
          periods,
          selectedPeriod,
          stats: {
            target,
            approved,
            pending: count("PENDING"),
            rejected: count("REJECTED"),
            compliance,
          },
          rank: {
            position: myIndex < 0 ? null : myIndex + 1,
            total: allRanked.length,
          },
          leaderboard: allRanked.slice(0, 5),
          periodPrograms,
          recentActivities,
        },
        "Berhasil",
      ),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/pic/dashboard");
  }
}
