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
    const branchId = searchParams.get("branchId") || undefined;
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
        if (branchId) {
          whereClause.branchId = branchId;
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
    let startMonth = 0;
    let endMonth = 11;

    switch (periode) {
      case "TW1":
        endMonth = 2;
        break; // Jan-Mar
      case "TW2":
        startMonth = 3;
        endMonth = 5;
        break; // Apr-Jun
      case "TW3":
        startMonth = 6;
        endMonth = 8;
        break; // Jul-Sep
      case "TW4":
        startMonth = 9;
        endMonth = 11;
        break; // Okt-Des
      case "SM1":
        endMonth = 5;
        break; // Jan-Jun
      case "SM2":
        startMonth = 6;
        endMonth = 11;
        break; // Jul-Des
      case "ALL":
      default:
        break; // Jan-Des
    }

    const summaryStartDate = new Date(year, startMonth, 1);
    const summaryEndDate = new Date(year, endMonth + 1, 0, 23, 59, 59);

    const summaryWhereClause = {
      ...whereClause,
      tanggalKegiatan: {
        gte: summaryStartDate,
        lte: summaryEndDate,
      },
    };

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

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    const [
      totalKegiatan,
      totalApproved,
      totalPending,
      totalRejected,
      laporanBulanIni,
      laporanBulanLalu,
      branchAktifRaw,
      regionAktifRaw,
      divisionAktifRaw,
    ] = await Promise.all([
      prisma.activityReport.count({ where: summaryWhereClause }),
      prisma.activityReport.count({
        where: { ...summaryWhereClause, status: "APPROVED" },
      }),
      prisma.activityReport.count({
        where: { ...summaryWhereClause, status: "PENDING" },
      }),
      prisma.activityReport.count({
        where: { ...summaryWhereClause, status: "REJECTED" },
      }),
      prisma.activityReport.count({
        where: {
          ...whereClause,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.activityReport.count({
        where: {
          ...whereClause,
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
      prisma.activityReport.groupBy({
        by: ["branchId"],
        where: { ...whereClause, branchId: { not: null } },
      }),
      prisma.activityReport.groupBy({
        by: ["regionId"],
        where: { ...whereClause, regionId: { not: null }, branchId: null },
      }),
      prisma.activityReport.groupBy({
        by: ["divisionId"],
        where: { ...whereClause, divisionId: { not: null } },
      }),
    ]);

    const totalUnitAktif =
      branchAktifRaw.length + regionAktifRaw.length + divisionAktifRaw.length;

    // 5. Kegiatan per bulan, triwulan, dan semester (SAFE COUNTING)

    const prevYear = year - 1;
    const months = Array.from({ length: 12 }, (_, i) => i);
    // Bikin array of promises untuk 12 bulan (Tahun ini & Tahun Lalu)
    const countsPromises = months.flatMap((month) => {
      const startThisYear = new Date(year, month, 1);
      const endThisYear = new Date(year, month + 1, 0, 23, 59, 59);
      const startLastYear = new Date(prevYear, month, 1);
      const endLastYear = new Date(prevYear, month + 1, 0, 23, 59, 59);
      return [
        prisma.activityReport.count({
          where: {
            ...whereClause,
            tanggalKegiatan: { gte: startThisYear, lte: endThisYear },
          },
        }),
        prisma.activityReport.count({
          where: {
            ...whereClause,
            tanggalKegiatan: { gte: startLastYear, lte: endLastYear },
          },
        }),
      ];
    });
    // Jalankan semua query database secara bersamaan!
    const countsResults = await Promise.all(countsPromises);
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
      periode: bulan,
      tahunIni: countsResults[index * 2], // index Genap
      tahunLalu: countsResults[index * 2 + 1], // index Ganjil
    }));
    // --- B. GENERATE DATA TRIWULAN ---
    const namaTriwulan = [
      "Triwulan 1",
      "Triwulan 2",
      "Triwulan 3",
      "Triwulan 4",
    ];
    const kegiatanPerTriwulan = namaTriwulan.map((tw, index) => {
      const startIdx = index * 3;
      return {
        periode: tw,
        tahunIni: kegiatanPerBulan
          .slice(startIdx, startIdx + 3)
          .reduce((sum, item) => sum + item.tahunIni, 0),
        tahunLalu: kegiatanPerBulan
          .slice(startIdx, startIdx + 3)
          .reduce((sum, item) => sum + item.tahunLalu, 0),
      };
    });
    // --- C. GENERATE DATA SEMESTER ---
    const namaSemester = ["Semester 1", "Semester 2"];
    const kegiatanPerSemester = namaSemester.map((sem, index) => {
      const startIdx = index * 6;
      return {
        periode: sem,
        tahunIni: kegiatanPerBulan
          .slice(startIdx, startIdx + 6)
          .reduce((sum, item) => sum + item.tahunIni, 0),
        tahunLalu: kegiatanPerBulan
          .slice(startIdx, startIdx + 6)
          .reduce((sum, item) => sum + item.tahunLalu, 0),
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
