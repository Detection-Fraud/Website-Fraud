import { prisma } from "@/lib/prisma";
import { getApprovalStatusText } from "../constants";
import { RankingParams } from "./types";

const RANKING_PAGE_SIZE = 10;

export async function getRanking(params: RankingParams) {
  const {
    whereClause,
    kanwilId,
    kancabId,
    divisiId,
    unitType,
    rankingPage,
    rankingUnitId,
    user,
  } = params;

  const fullWhereClause = whereClause;

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
        where: { AND: [fullWhereClause, { unitId: kancabId }] },
      });
      const totalDisetujuiRaw = await prisma.activityReport.count({
        where: {
          AND: [fullWhereClause, { unitId: kancabId }, { status: "APPROVED" }],
        },
      });
      const approvalRate =
        totalKegiatanRaw > 0 ? (totalDisetujuiRaw / totalKegiatanRaw) * 100 : 0;

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
      where: {
        AND: [fullWhereClause, { unitId: { in: kancabs.map((k) => k.id) } }],
      },
      _count: { id: true },
    });

    const approvedRaw = await prisma.activityReport.groupBy({
      by: ["unitId"],
      where: {
        AND: [
          fullWhereClause,
          { unitId: { in: kancabs.map((k) => k.id) } },
          { status: "APPROVED" },
        ],
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
          where: { AND: [fullWhereClause, { unitId: divisiId }] },
        }),
        prisma.activityReport.count({
          where: {
            AND: [fullWhereClause, { unitId: divisiId }, { status: "APPROVED" }],
          },
        }),
      ]);

      const approvalRate =
        totalKegiatanRaw > 0 ? (totalDisetujuiRaw / totalKegiatanRaw) * 100 : 0;

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
        where: { ...fullWhereClause, unitId: { not: null } },
        _count: { id: true },
      }),
      prisma.activityReport.groupBy({
        by: ["unitId"],
        where: {
          ...fullWhereClause,
          unitId: { not: null },
          status: "APPROVED",
        },
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

  return {
    rankingWilayah,
    rankingTotal,
    rankingTotalPages,
  };
}
