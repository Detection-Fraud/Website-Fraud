import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

async function getDistribusiForRange(
  whereClause: any,
  startMonth: number,
  endMonth: number,
  year: number,
) {
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59);

  const raw = await prisma.activityReport.groupBy({
    by: ["programId"],
    where: {
      ...whereClause,
      programId: { not: null },
      tanggalKegiatan: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
  });

  const programsIds = raw
    .map((item) => item.programId)
    .filter(Boolean) as string[];
  const programs = await prisma.programBudaya.findMany({
    where: { id: { in: programsIds } },
    select: { id: true, name: true },
  });

  return raw.map((item) => ({
    name: programs.find((p) => p.id === item.programId)?.name || "Lainnya",
    value: item._count.id,
  }));
}
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

    const periode = searchParams.get("periode") || "ALL";

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

    const totalApproved = await prisma.activityReport.count({
      where: { ...whereClause, status: "APPROVED" },
    });

    const totalPending = await prisma.activityReport.count({
      where: { ...whereClause, status: "PENDING" },
    });

    const totalRejected = await prisma.activityReport.count({
      where: { ...whereClause, status: "REJECTED" },
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

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const laporanBulanLalu = await prisma.activityReport.count({
      where: {
        ...whereClause,
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });

    // 5. Kegiatan per bulan

    const prevYear = year - 1;

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const startOfPrevYear = new Date(prevYear, 0, 1);
    const endOfPrevYear = new Date(prevYear, 11, 31, 23, 59, 59);

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

    const reportsInPrevYear = await prisma.activityReport.findMany({
      where: {
        ...whereClause,
        tanggalKegiatan: { gte: startOfPrevYear, lte: endOfPrevYear },
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

    // --- A. GENERATE DATA BULANAN ---
    const kegiatanPerBulan = namaBulan.map((bulan, index) => ({
      periode: bulan, // Kita ubah key-nya jadi 'periode' biar dinamis
      tahunIni: reportsInYear.filter(
        (r) => new Date(r.tanggalKegiatan).getMonth() === index,
      ).length,
      tahunLalu: reportsInPrevYear.filter(
        (r) => new Date(r.tanggalKegiatan).getMonth() === index,
      ).length,
    }));

    // ---B. Generate Data TRIWULAN ---
    const namaTriwulan = [
      "Triwulan 1",
      "Triwulan 2",
      "Triwulan 3",
      "Triwulan 4",
    ];
    const kegiatanPerTriwulan = namaTriwulan.map((tw, index) => {
      const startMonth = index * 3;
      const endMonth = startMonth + 2;

      return {
        periode: tw,
        tahunIni: reportsInYear.filter((r) => {
          const m = new Date(r.tanggalKegiatan).getMonth();
          return m >= startMonth && m <= endMonth;
        }).length,
        tahunLalu: reportsInPrevYear.filter((r) => {
          const m = new Date(r.tanggalKegiatan).getMonth();
          return m >= startMonth && m <= endMonth;
        }).length,
      };
    });

    // --- C. GENERATE DATA SEMESTER ---
    const namaSemester = ["Semester 1", "Semester 2"];
    const kegiatanPerSemester = namaSemester.map((sem, index) => {
      const startMonth = index * 6;
      const endMonth = startMonth + 5;

      return {
        periode: sem,
        tahunIni: reportsInYear.filter((r) => {
          const m = new Date(r.tanggalKegiatan).getMonth();
          return m >= startMonth && m <= endMonth;
        }).length,
        tahunLalu: reportsInPrevYear.filter((r) => {
          const m = new Date(r.tanggalKegiatan).getMonth();
          return m >= startMonth && m <= endMonth;
        }).length,
      };
    });

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
    let distribusiProgram: any[] = [];

    switch (periode) {
      case "TW1":
        distribusiProgram = await getDistribusiForRange(
          whereClause,
          0,
          2,
          year,
        ); // Jan-Mar
        break;
      case "TW2":
        distribusiProgram = await getDistribusiForRange(
          whereClause,
          3,
          5,
          year,
        ); // Apr-Jun
        break;
      case "TW3":
        distribusiProgram = await getDistribusiForRange(
          whereClause,
          6,
          8,
          year,
        ); // Jul-Sep
        break;
      case "TW4":
        distribusiProgram = await getDistribusiForRange(
          whereClause,
          9,
          11,
          year,
        ); // Okt-Des
        break;
      case "SM1":
        distribusiProgram = await getDistribusiForRange(
          whereClause,
          0,
          5,
          year,
        ); // Jan-Jun
        break;
      case "SM2":
        distribusiProgram = await getDistribusiForRange(
          whereClause,
          6,
          11,
          year,
        ); // Jul-Des
        break;
      case "ALL":
      default:
        // Sepanjang tahun (Januari - Desember)
        distribusiProgram = await getDistribusiForRange(
          whereClause,
          0,
          11,
          year,
        );
        break;
    }

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

    const approvedRaw = await prisma.activityReport.groupBy({
      by: ["regionId"],
      where: {
        ...whereClause,
        regionId: { not: null },
        status: "APPROVED",
      },
      _count: { id: true },
    });

    const regionIds = rankingRaw
      .map((item) => item.regionId)
      .filter(Boolean) as string[];

    const regionsList = await prisma.region.findMany({
      where: { id: { in: regionIds } },
      select: { id: true, name: true },
    });

    const branchCounts = await prisma.branch.groupBy({
      by: ["regionId"],
      where: { regionId: { in: regionIds } },
      _count: { id: true },
    });

    const rankingWilayah = rankingRaw.map((item, index) => {
      const totalKegiatan = item._count.id;
      const totalDisetujui =
        approvedRaw.find((a) => a.regionId === item.regionId)?._count.id || 0;
      const unitCount =
        branchCounts.find((b) => b.regionId === item.regionId)?._count.id || 0;

      const approvalRate =
        totalKegiatan > 0 ? (totalDisetujui / totalKegiatan) * 100 : 0;

      // Logic Penentuan Status
      let statusText = "Perlu Perhatian";
      if (approvalRate >= 90) statusText = "Sangat Baik";
      else if (approvalRate >= 80) statusText = "Baik";
      else if (approvalRate >= 70) statusText = "Cukup";

      return {
        rank: index + 1,
        name:
          regionsList.find((r) => r.id === item.regionId)?.name || "Unknown",
        unit: unitCount,
        kegiatan: totalKegiatan,
        disetujui: totalDisetujui,
        approvalRate: Number(approvalRate.toFixed(1)),
        status: statusText,
      };
    });

    // 9. Return response
    return NextResponse.json(
      successResponse(
        {
          summary: {
            totalKegiatan,
            totalApproved,
            totalPending,
            totalRejected,
            totalUnitAktif,
            laporanBulanIni,
            laporanBulanLalu,
          },
          charts: {
            kegiatanPerBulan,
            kegiatanPerTriwulan,
            kegiatanPerSemester,
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
