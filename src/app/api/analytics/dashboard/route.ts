
import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { getApprovalStatusText, getMonthRange } from "@/lib/api/constants";
import { buildUnitScope } from "@/lib/api/unit-scope";
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
    const session = await requireAuth();
    const user = session.user;

    const searchParams = request.nextUrl.searchParams;
    const kanwilId = searchParams.get("kanwilId") || undefined;
    const kancabId = searchParams.get("kancabId") || undefined;
    const divisiId = searchParams.get("divisiId") || undefined;
    const rankingPage = parseInt(searchParams.get("rankingPage") || "1");
    const rankingUnitId = searchParams.get("rankingUnitId") || undefined;
    const RANKING_PAGE_SIZE = 10;
    const programId = searchParams.get("programId") || undefined;
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );
    const periode = searchParams.get("periode") || "ALL";
    const unitType = searchParams.get("unitType") || "ALL";

    const whereClause: any = await buildUnitScope({
      user,
      kanwilId,
      kancabId,
      divisiId,
    });

    if (programId) {
      whereClause.programId = programId;
    }

    // 2. Summary cards (Total, Approved, Pending, dll)
    const { startMonth, endMonth } = getMonthRange(periode);

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
    ]);

    // Menghitung total unit aktif untuk konteks user saat ini
    const totalUnitAktifRaw = await prisma.activityReport.groupBy({
      by: ["unitId"],
      where: { ...whereClause, unitId: { not: null } },
    });
    const totalUnitAktif = totalUnitAktifRaw.length;

    // 3. Kegiatan per bulan, triwulan, dan semester
    const prevYear = year - 1;
    const months = Array.from({ length: 12 }, (_, i) => i);
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

    const kegiatanPerBulan = namaBulan.map((bulan, index) => ({
      periode: bulan,
      tahunIni: countsResults[index * 2],
      tahunLalu: countsResults[index * 2 + 1],
    }));

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

    // 4. Top 5 unit teraktif
    const topUnitRaw = await prisma.activityReport.groupBy({
      by: ["unitId"],
      where: {
        ...whereClause,
        unitId: { not: null },
      },
      _count: { id: true },
      orderBy: {
        _count: { id: "desc" },
      },
      take: 5,
    });

    const unitIds = topUnitRaw
      .map((item) => item.unitId)
      .filter(Boolean) as string[];
    const unitsData = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, name: true, type: true },
    });

    const topUnit = topUnitRaw.map((item) => {
      const unitInfo = unitsData.find((u) => u.id === item.unitId);
      return {
        name: unitInfo?.name || "Unknown Unit",
        jumlah: item._count.id,
        type:
          unitInfo?.type === "KANTOR_CABANG"
            ? "Kancab"
            : unitInfo?.type === "KANTOR_WILAYAH"
              ? "Kanwil"
              : "Divisi",
      };
    });

    // 5. Distribusi program budaya
    const distribusiProgram = await getDistribusiForRange(
      whereClause,
      startMonth,
      endMonth,
      year,
    );

    // 6. Ranking wilayah
    let rankingWilayah: {
      rank: number;
      name: string;
      unit: number;
      kegiatan: number;
      disetujui: number;
      approvalRate: number;
      status: string;
    }[] = [];

    let rankingTotal = 0;
    let rankingTotalPages = 1;

    if (kancabId || (user.unitType === "KANTOR_WILAYAH" && kancabId)) {
      // Mode spesifik 1 kancab: hanya kancab tsb
      const kancab = await prisma.unit.findUnique({ where: { id: kancabId } });
      if (kancab) {
        const totalKegiatanRaw = await prisma.activityReport.count({
          where: { ...whereClause, unitId: kancabId },
        });
        const totalDisetujuiRaw = await prisma.activityReport.count({
          where: { ...whereClause, unitId: kancabId, status: "APPROVED" },
        });
        const approvalRate =
          totalKegiatanRaw > 0
            ? (totalDisetujuiRaw / totalKegiatanRaw) * 100
            : 0;

        const statusText = getApprovalStatusText(approvalRate);

        rankingWilayah.push({
          rank: 1,
          name: kancab.name,
          unit: 0,
          kegiatan: totalKegiatanRaw,
          disetujui: totalDisetujuiRaw,
          approvalRate: Number(approvalRate.toFixed(1)),
          status: statusText,
        });
      }
    } else if (
      (kanwilId && unitType !== "WILAYAH") ||
      user.unitType === "KANTOR_WILAYAH"
    ) {
      // Filter spesifik 1 Kanwil, list semua kancab di bawahnya
      const activeKanwilId = kanwilId || user.unitId;
      const kancabs = await prisma.unit.findMany({
        where: { parentId: activeKanwilId, type: "KANTOR_CABANG" },
      });

      const rankingRaw = await prisma.activityReport.groupBy({
        by: ["unitId"],
        where: { ...whereClause, unitId: { in: kancabs.map((k) => k.id) } },
        _count: { id: true },
      });

      const approvedRaw = await prisma.activityReport.groupBy({
        by: ["unitId"],
        where: {
          ...whereClause,
          unitId: { in: kancabs.map((k) => k.id) },
          status: "APPROVED",
        },
        _count: { id: true },
      });

      rankingWilayah = rankingRaw
        .map((item) => {
          const totalKegiatan = item._count.id;
          const totalDisetujui =
            approvedRaw.find((a) => a.unitId === item.unitId)?._count.id || 0;
          const approvalRate =
            totalKegiatan > 0 ? (totalDisetujui / totalKegiatan) * 100 : 0;

          const statusText = getApprovalStatusText(approvalRate);

          return {
            name: kancabs.find((k) => k.id === item.unitId)?.name || "Unknown",
            unit: 0, // 0 kancab bawahan karena ini sudah kancab
            kegiatan: totalKegiatan,
            disetujui: totalDisetujui,
            approvalRate: Number(approvalRate.toFixed(1)),
            status: statusText,
          };
        })
        .sort(
          (a, b) => b.approvalRate - a.approvalRate || b.kegiatan - a.kegiatan,
        )
        .map((item, index) => ({ ...item, rank: index + 1 }));
    } else if (divisiId) {
      const divisi = await prisma.unit.findUnique({
        where: { id: divisiId },
      });
      if (divisi) {
        const [totalKegiatanRaw, totalDisetujuiRaw] = await Promise.all([
          prisma.activityReport.count({
            where: { ...whereClause, unitId: divisiId },
          }),
          prisma.activityReport.count({
            where: { ...whereClause, unitId: divisiId, status: "APPROVED" },
          }),
        ]);

        const approvalRate =
          totalKegiatanRaw > 0
            ? (totalDisetujuiRaw / totalKegiatanRaw) * 100
            : 0;

        const statusText = getApprovalStatusText(approvalRate);

        rankingWilayah.push({
          rank: 1,
          name: divisi.name,
          unit: 0,
          kegiatan: totalKegiatanRaw,
          disetujui: totalDisetujuiRaw,
          approvalRate: Number(approvalRate.toFixed(1)),
          status: statusText,
        });
      }
    } else {
      // Tampilkan semua unit — filter berdasarkan unitType jika dipilih
      const unitWhere: any = {};
      if (rankingUnitId) unitWhere.id = rankingUnitId;

      if (kanwilId && unitType === "WILAYAH") {
        unitWhere.id = kanwilId;
      }

      // Filter unit berdasarkan tipe yang dipilih user di UI
      const UNIT_TYPE_MAP: Record<string, string> = {
        WILAYAH: "KANTOR_WILAYAH",
        CABANG: "KANTOR_CABANG",
        DIVISI: "DIVISI",
      };
      if (unitType !== "ALL" && UNIT_TYPE_MAP[unitType]) {
        unitWhere.type = UNIT_TYPE_MAP[unitType];
      }

      const allUnitRaw = await prisma.unit.findMany({
        where: unitWhere,
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      const [kegiatanPerUnit, approvedPerUnit] = await Promise.all([
        prisma.activityReport.groupBy({
          by: ["unitId"],
          where: { ...whereClause, unitId: { not: null } },
          _count: { id: true },
        }),
        prisma.activityReport.groupBy({
          by: ["unitId"],
          where: { ...whereClause, unitId: { not: null }, status: "APPROVED" },
          _count: { id: true },
        }),
      ]);

      const allRankings = allUnitRaw
        .map((unit) => {
          const kegiatan =
            kegiatanPerUnit.find((k) => k.unitId === unit.id)?._count.id ?? 0;
          const disetujui =
            approvedPerUnit.find((a) => a.unitId === unit.id)?._count.id ?? 0;

          if (kegiatan === 0) return null;

          const approvalRate = (disetujui / kegiatan) * 100;

          const statusText = getApprovalStatusText(approvalRate);

          return {
            name: unit.name,
            unitType: unit.type,
            unit: 0,
            kegiatan,
            disetujui,
            approvalRate: Number(approvalRate.toFixed(1)),
            status: statusText,
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            b!.approvalRate - a!.approvalRate || b!.kegiatan - a!.kegiatan,
        );

      rankingTotal = allRankings.length;
      rankingTotalPages = Math.ceil(rankingTotal / RANKING_PAGE_SIZE);

      rankingWilayah = allRankings
        .slice(
          (rankingPage - 1) * RANKING_PAGE_SIZE,
          rankingPage * RANKING_PAGE_SIZE,
        )
        .map((item, idx) => ({
          ...item!,
          // Rank global = offset halaman + index lokal + 1
          rank: (rankingPage - 1) * RANKING_PAGE_SIZE + idx + 1,
        }));
    }

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
            rankingTotal,
            rankingPage,
            rankingTotalPages,
          },
        },
        "Berhasil mengambil data analytics",
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/analytics/dashboard");
  }
}
