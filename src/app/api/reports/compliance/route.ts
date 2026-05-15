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
    const regionId = searchParams.get("regionId") || "ALL";
    const branchId = searchParams.get("branchId") || "ALL";
    const divisionId = searchParams.get("divisionId") || "ALL";

    const unitType = searchParams.get("unitType") || "NASIONAL";

    let activeUnits: Array<{
      id: string;
      name: string;
      type: UnitType;
      wilayah: string;
      regionId?: string;
    }> = [];

    const hasPIC = { users: { some: { role: "PIC" as const } } };

    if (divisionId !== "ALL") {
      const div = await prisma.division.findFirst({
        where: { id: divisionId, ...hasPIC },
      });
      if (div)
        activeUnits.push({
          id: div.id,
          name: div.name,
          type: "DIVISION",
          wilayah: "Kantor Pusat",
        });
    } else if (branchId !== "ALL") {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, ...hasPIC },
        include: { region: true },
      });
      if (branch)
        activeUnits.push({
          id: branch.id,
          name: branch.name,
          type: "BRANCH",
          wilayah: branch.region.name,
          regionId: branch.regionId,
        });
    } else if (regionId !== "ALL") {
      const region = await prisma.region.findFirst({
        where: { id: regionId, ...hasPIC },
      });
      const branches = await prisma.branch.findMany({
        where: { regionId, ...hasPIC },
        include: { region: true },
      });
      if (region)
        activeUnits.push({
          id: region.id,
          name: region.name,
          type: "REGION",
          wilayah: region.name,
          regionId: region.id,
        });
      branches.forEach((b) =>
        activeUnits.push({
          id: b.id,
          name: b.name,
          type: "BRANCH",
          wilayah: b.region.name,
          regionId: b.regionId,
        }),
      );
    } else {
      const [regions, branches, division] = await Promise.all([
        prisma.region.findMany({ where: hasPIC }),
        prisma.branch.findMany({ where: hasPIC, include: { region: true } }),
        prisma.division.findMany({ where: hasPIC }),
      ]);
      regions.forEach((r) =>
        activeUnits.push({
          id: r.id,
          name: r.name,
          type: "REGION",
          wilayah: r.name,
          regionId: r.id,
        }),
      );
      branches.forEach((b) =>
        activeUnits.push({
          id: b.id,
          name: b.name,
          type: "BRANCH",
          wilayah: b.region.name,
          regionId: b.regionId,
        }),
      );
      division.forEach((d) =>
        activeUnits.push({
          id: d.id,
          name: d.name,
          type: "DIVISION",
          wilayah: "Kantor Pusat",
        }),
      );
    }

    if (user.role === "PIC" || user.role === "VIEWER") {
      if (user.branchId) {
        activeUnits = activeUnits.filter((unit) => unit.id === user.branchId);
      } else if (user.regionId) {
        activeUnits = activeUnits.filter(
          (u) =>
            u.id === user.regionId ||
            u.regionId === user.regionId ||
            u.wilayah === user.regionName,
        );
      } else if (user.divisionId) {
        activeUnits = activeUnits.filter((u) => u.id === user.divisionId);
      }
    }

    if (unitType === "REGION") {
      activeUnits = activeUnits.filter((u) => u.type === "REGION");
    } else if (unitType === "BRANCH") {
      activeUnits = activeUnits.filter((u) => u.type === "BRANCH");
    } else if (unitType === "DIVISION") {
      activeUnits = activeUnits.filter((u) => u.type === "DIVISION");
    } else if (unitType === "REGION_AND_BRANCH") {
      activeUnits = activeUnits.filter(
        (u) => u.type === "REGION" || u.type === "BRANCH",
      );
    }

    const [programs, submissions] = await Promise.all([
      // Ambil program
      prisma.programBudaya.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.activityReport.groupBy({
        by: ["regionId", "branchId", "divisionId", "programId"],
        where: {
          status: "APPROVED",
          ...(programId !== "ALL" && { programId }),
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

    const getUnitSubmissions = (
      unitId: string,
      unitType: UnitType,
      progId: string,
    ) => {
      let sum = 0;
      for (const sub of submissions) {
        if (sub.programId !== progId) continue;
        if (
          unitType === "REGION" &&
          sub.regionId === unitId &&
          sub.branchId === null
        )
          sum += sub._count.id;
        if (unitType === "BRANCH" && sub.branchId === unitId)
          sum += sub._count.id;
        if (unitType === "DIVISION" && sub.divisionId === unitId)
          sum += sub._count.id;
      }
      return sum;
    };

    const tableData = activeUnits.map((unit) => {
      const programCompliance = programInfoList.map((prog) => {
        const submitted = getUnitSubmissions(unit.id, unit.type, prog.id);
        const target = prog.frequency;
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

    const totalUnit = tableData.length;
    const avgCompliance =
      totalUnit > 0
        ? Math.round(tableData.reduce((sum, u) => sum + u.avg, 0) / totalUnit)
        : 0;
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
    console.log("ERROR GET /api/reports/compliance", error);
    return NextResponse.json(errorResponse("Internal Server Error"), {
      status: 500,
    });
  }
}
