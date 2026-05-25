import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { UnitType } from "@/types/compliance.types";
import { NextResponse } from "next/server";

const PROGRAM_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId") || "ALL";
    const kanwilId = searchParams.get("kanwilId") || "ALL";
    const kancabId = searchParams.get("kancabId") || "ALL";
    const divisiId = searchParams.get("divisiId") || "ALL";

    // "NASIONAL" | "KANWIL" | "KANCAB" | "DIVISI" | "KANWIL_AND_KANCAB"
    const unitTypeFilter = searchParams.get("unitType") || "NASIONAL";

    let activeUnits: Array<{
      id: string;
      name: string;
      type: string;
      wilayah: string;
      parentId?: string | null;
    }> = [];

    const hasPIC = { users: { some: { role: "PIC" as const } } };

    // 1. Ambil Unit yang aktif (memiliki PIC)
    if (divisiId !== "ALL") {
      const div = await prisma.unit.findFirst({
        where: { id: divisiId, type: "DIVISI", ...hasPIC },
      });
      if (div)
        activeUnits.push({
          id: div.id,
          name: div.name,
          type: "DIVISI",
          wilayah: "Kantor Pusat",
        });
    } else if (kancabId !== "ALL") {
      const kancab = await prisma.unit.findFirst({
        where: { id: kancabId, type: "KANTOR_CABANG", ...hasPIC },
        include: { parent: true },
      });
      if (kancab)
        activeUnits.push({
          id: kancab.id,
          name: kancab.name,
          type: "KANTOR_CABANG",
          wilayah: kancab.parent?.name || "Unknown",
          parentId: kancab.parentId,
        });
    } else if (kanwilId !== "ALL") {
      const kanwil = await prisma.unit.findFirst({
        where: { id: kanwilId, type: "KANTOR_WILAYAH", ...hasPIC },
      });
      const kancabs = await prisma.unit.findMany({
        where: { parentId: kanwilId, type: "KANTOR_CABANG", ...hasPIC },
        include: { parent: true },
      });
      if (kanwil)
        activeUnits.push({
          id: kanwil.id,
          name: kanwil.name,
          type: "KANTOR_WILAYAH",
          wilayah: kanwil.name,
          parentId: kanwil.id, // Untuk referensi
        });
      kancabs.forEach((b) =>
        activeUnits.push({
          id: b.id,
          name: b.name,
          type: "KANTOR_CABANG",
          wilayah: b.parent?.name || "Unknown",
          parentId: b.parentId,
        }),
      );
    } else {
      const units = await prisma.unit.findMany({
        where: hasPIC,
        include: { parent: true },
      });

      units.forEach((u) => {
        let wilayah = "";
        if (u.type === "DIVISI") wilayah = "Kantor Pusat";
        else if (u.type === "KANTOR_WILAYAH") wilayah = u.name;
        else if (u.type === "KANTOR_CABANG")
          wilayah = u.parent?.name || "Unknown";

        activeUnits.push({
          id: u.id,
          name: u.name,
          type: u.type,
          wilayah,
          parentId: u.parentId,
        });
      });
    }

    // 2. Terapkan batasan role
    if (user.role === "PIC" || user.role === "VIEWER") {
      if (user.unitId) {
        if (user.unitType === "KANTOR_WILAYAH") {
          activeUnits = activeUnits.filter(
            (u) => u.id === user.unitId || u.parentId === user.unitId,
          );
        } else {
          activeUnits = activeUnits.filter((u) => u.id === user.unitId);
        }
      }
    }

    // 3. Terapkan filter tipe unit
    if (unitTypeFilter === "KANWIL") {
      activeUnits = activeUnits.filter((u) => u.type === "KANTOR_WILAYAH");
    } else if (unitTypeFilter === "KANCAB") {
      activeUnits = activeUnits.filter((u) => u.type === "KANTOR_CABANG");
    } else if (unitTypeFilter === "DIVISI") {
      activeUnits = activeUnits.filter((u) => u.type === "DIVISI");
    } else if (unitTypeFilter === "KANWIL_AND_KANCAB") {
      activeUnits = activeUnits.filter(
        (u) => u.type === "KANTOR_WILAYAH" || u.type === "KANTOR_CABANG",
      );
    }

    // 4. Ambil program dan aggregasi laporan
    const [programs, submissions] = await Promise.all([
      prisma.programBudaya.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.activityReport.groupBy({
        by: ["unitId", "programId"],
        where: {
          status: "APPROVED",
          ...(programId !== "ALL" && { programId }),
          unitId: { not: null },
        },
        _count: { id: true },
      }),
    ]);

    const programInfoList = programs.map((p, i) => ({
      id: p.id,
      name: p.name,
      frequency: p.frequency,
      color: PROGRAM_COLORS[i % PROGRAM_COLORS.length],
    }));

    const getUnitSubmissions = (unitId: string, progId: string) => {
      let sum = 0;
      for (const sub of submissions) {
        if (sub.programId === progId && sub.unitId === unitId) {
          sum += sub._count.id;
        }
      }
      return sum;
    };

    // 5. Kalkulasi compliance per unit
    const tableData = activeUnits.map((unit) => {
      const programCompliance = programInfoList.map((prog) => {
        const submitted = getUnitSubmissions(unit.id, prog.id);
        const target = prog.frequency;
        // Rumus compliance = (submitted / target) * 100
        const pct = Math.round((submitted / target) * 100);
        return {
          programId: prog.id,
          pct,
          submitted,
          target,
        };
      });

      const relevantPct =
        programId === "ALL"
          ? programCompliance.map((p) => p.pct)
          : programCompliance
              .filter((p) => p.programId === programId)
              .map((p) => p.pct);

      // Avg per unit (filter = semua) -> AVG(compliance % across all active programs)
      const avg =
        relevantPct.length > 0
          ? Math.round(
              relevantPct.reduce((a, b) => a + b, 0) / relevantPct.length,
            )
          : 0;

      return {
        rank: 0,
        unit,
        programCompliance,
        avg,
      };
    });

    tableData.sort((a, b) => b.avg - a.avg);
    tableData.forEach((row, index) => {
      row.rank = index + 1;
    });

    // 6. Hitung statistik keseluruhan
    const totalUnit = tableData.length;
    const avgCompliance =
      totalUnit > 0
        ? Math.round(tableData.reduce((sum, u) => sum + u.avg, 0) / totalUnit)
        : 0;

    // Status threshold: On Track >= 50% | Behind 25-49% | At Risk < 25%
    const unitOnTrack = tableData.filter((u) => u.avg >= 50).length;
    const waspada = tableData.filter((u) => u.avg >= 25 && u.avg < 50).length;
    const perluPerhatian = tableData.filter((u) => u.avg < 25).length;

    return NextResponse.json(
      successResponse(
        {
          cards: {
            totalUnit,
            avgCompliance,
            unitOnTrack,
            waspada,
            perluPerhatian,
          },
          programs: programInfoList,
          tableData,
        },
        "Berhasil memuat data compliance",
      ),
      { status: 200 },
    );
  } catch (error) {
    console.error("ERROR GET /api/reports/compliance", error);
    return NextResponse.json(errorResponse("Internal Server Error"), {
      status: 500,
    });
  }
}
