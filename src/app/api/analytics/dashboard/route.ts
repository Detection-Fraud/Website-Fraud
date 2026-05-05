import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // 1. Cek autentikasi
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    // 2. Ambil filter dari query params
    const searchParams = request.nextUrl.searchParams;
    const regionId = searchParams.get("regionId") || undefined;
    const programId = searchParams.get("programId") || undefined;
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );

    // 3. Base where clause berdasarkan role
    let whereClause: any = {};

    switch (user.role) {
      case "ADMIN":
        if (regionId) {
          whereClause.regionId = regionId;
        }
        break;
      case "PIC":
        if (user.branchId) {
          whereClause.branchId = user.branchId;
        } else if (user.regionId) {
          whereClause.regionId = user.regionId;
        } else if (user.divisionId) {
          whereClause.divisionId = user.divisionId;
        }
        break;
      default:
        return NextResponse.json(errorResponse("Akses ditolak", 403), {
          status: 403,
        });
    }

    if (programId) {
      whereClause.programId = programId;
    }

    // 4. Summary cards
    const totalKegiatan = await prisma.activityReport.count({
      where: whereClause,
    });

    const branchAktif = await prisma.activityReport.findMany({
      where: { ...whereClause, branchId: { not: null } },
      select: { branchId: true },
      distinct: ["branchId"],
    });

    const regionAktif = await prisma.activityReport.findMany({
      where: { ...whereClause, regionId: { not: null }, branchId: null },
      select: { regionId: true },
      distinct: ["regionId"],
    });

    const divisionAktif = await prisma.activityReport.findMany({
      where: { ...whereClause, divisionId: { not: null } },
      select: { divisionId: true },
      distinct: ["divisionId"],
    });

    const totalUnitAktif =
      branchAktif.length + regionAktif.length + divisionAktif.length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const laporanBulanIni = await prisma.activityReport.count({
      where: {
        ...whereClause,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // 5. Kegiatan per bulan
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const reportsInYear = await prisma.activityReport.findMany({
      where: {
        ...whereClause,
        tanggalKegiatan: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: { tanggalKegiatan: true },
    });

    const namaBulan = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];

    const kegiatanPerBulan = namaBulan.map((bulan, index) => ({
      bulan,
      jumlah: reportsInYear.filter(
        (r) => new Date(r.tanggalKegiatan).getMonth() === index,
      ).length,
    }));

    // 6. Top 5 unit teraktif (gabungan Branch, Region, dan Division)
    // 6a. Group by Branch
    const topBranchRaw = await prisma.activityReport.groupBy({
      by: ["branchId"],
      where: {
        ...whereClause,
        branchId: { not: null },
      },
      _count: { id: true },
    });

    const branchIds = topBranchRaw
      .map((item) => item.branchId)
      .filter(Boolean) as string[];

    const branches = await prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });

    const branchUnits = topBranchRaw.map((item) => ({
      name:
        branches.find((b) => b.id === item.branchId)?.name || "Unknown Branch",
      jumlah: item._count.id,
      type: "Kancab" as const,
    }));

    // 6b. Group by Region (laporan yang langsung di-assign ke Kanwil, tanpa branch)
    const topRegionRaw = await prisma.activityReport.groupBy({
      by: ["regionId"],
      where: {
        ...whereClause,
        regionId: { not: null },
        branchId: null, // Hanya yang langsung di Kanwil (bukan via kancab)
      },
      _count: { id: true },
    });

    const topRegionIds = topRegionRaw
      .map((item) => item.regionId)
      .filter(Boolean) as string[];

    const topRegions = await prisma.region.findMany({
      where: { id: { in: topRegionIds } },
      select: { id: true, name: true },
    });

    const regionUnits = topRegionRaw.map((item) => ({
      name:
        topRegions.find((r) => r.id === item.regionId)?.name ||
        "Unknown Region",
      jumlah: item._count.id,
      type: "Kanwil" as const,
    }));

    // 6c. Group by Division
    const topDivisionRaw = await prisma.activityReport.groupBy({
      by: ["divisionId"],
      where: {
        ...whereClause,
        divisionId: { not: null },
      },
      _count: { id: true },
    });

    const divisionIds = topDivisionRaw
      .map((item) => item.divisionId)
      .filter(Boolean) as string[];

    const divisions = await prisma.division.findMany({
      where: { id: { in: divisionIds } },
      select: { id: true, name: true },
    });

    const divisionUnits = topDivisionRaw.map((item) => ({
      name:
        divisions.find((d) => d.id === item.divisionId)?.name ||
        "Unknown Division",
      jumlah: item._count.id,
      type: "Divisi" as const,
    }));

    // 6d. Gabungkan semua, urutkan, ambil top 5
    const topUnit = [...branchUnits, ...regionUnits, ...divisionUnits]
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 5);

    // 7. Distribusi program budaya
    const distribusiRaw = await prisma.activityReport.groupBy({
      by: ["programId"],
      where: {
        ...whereClause,
        programId: { not: null },
      },
      _count: { id: true },
    });

    const programIds = distribusiRaw
      .map((item) => item.programId)
      .filter(Boolean) as string[];

    const programs = await prisma.programBudaya.findMany({
      where: { id: { in: programIds } },
      select: { id: true, name: true },
    });

    const distribusiProgram = distribusiRaw.map((item) => ({
      name: programs.find((p) => p.id === item.programId)?.name || "Lainnya",
      value: item._count.id,
    }));

    // 8. Ranking wilayah
    const rankingRaw = await prisma.activityReport.groupBy({
      by: ["regionId"],
      where: {
        ...whereClause,
        regionId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const regionIds = rankingRaw
      .map((item) => item.regionId)
      .filter(Boolean) as string[];

    const regionsList = await prisma.region.findMany({
      where: { id: { in: regionIds } },
      select: { id: true, name: true },
    });

    const rankingWilayah = rankingRaw.map((item, index) => ({
      rank: index + 1,
      name: regionsList.find((r) => r.id === item.regionId)?.name || "Unknown",
      jumlah: item._count.id,
    }));

    // 9. Return response
    return NextResponse.json(
      successResponse(
        {
          summary: {
            totalKegiatan,
            totalUnitAktif,
            laporanBulanIni,
          },
          charts: {
            kegiatanPerBulan,
            topUnit,
            distribusiProgram,
            rankingWilayah,
          },
        },
        "Berhasil mengambil data analytics",
      ),
      { status: 200 },
    );
  } catch (error) {
    console.error("ERROR GET /api/analytics/dashboard:", error);
    return NextResponse.json(errorResponse("Gagal mengambil data analytics"), {
      status: 500,
    });
  }
}
