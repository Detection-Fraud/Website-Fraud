import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import { Prisma, ProgramBudaya } from "@generated/prisma";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

const MONTH_NAMES_ID = [
  "JANUARI",
  "FEBRUARI",
  "MARET",
  "APRIL",
  "MEI",
  "JUNI",
  "JULI",
  "AGUSTUS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DESEMBER",
];

const PERIODE_CONFIG = {
  "TW I": { months: [1, 2, 3], divisor: 4 },
  "TW II": { months: [4, 5, 6], divisor: 4 },
  "TW III": { months: [7, 8, 9], divisor: 4 },
  "TW IV": { months: [10, 11, 12], divisor: 4 },
  "SEMESTER I": { months: [1, 2, 3, 4, 5, 6], divisor: 2 },
  "SEMESTER II": { months: [7, 8, 9, 10, 11, 12], divisor: 2 },
} as const;

type PeriodeName = keyof typeof PERIODE_CONFIG;

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!session || user?.role !== "ADMIN") {
      return NextResponse.json(
        errorResponse("Hanya Admin yang dapat mengexport data", 403),
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );
    const programId = searchParams.get("programId") || "ALL";
    const kanwilId = searchParams.get("kanwilId") || "ALL";
    const kancabId = searchParams.get("kancabId") || "ALL";
    const divisiId = searchParams.get("divisiId") || "ALL";
    const unitTypeFilter = searchParams.get("unitType") || "NASIONAL";

    const activeUnits = await getActiveUnits({
      kanwilId,
      kancabId,
      divisiId,
      unitTypeFilter,
      user: session.user,
    });

    const programs = await prisma.programBudaya.findMany({
      where: {
        isActive: true,
        ...(programId !== "ALL" && { id: programId }),
      },
      orderBy: { createdAt: "asc" },
    });

    const monthlyData = await getMonthlySubmissions(
      year,
      activeUnits,
      programId,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Cubic - BULOG";
    workbook.created = new Date();

    for (const [periodeName, config] of Object.entries(PERIODE_CONFIG)) {
      buildSheet(workbook, {
        sheetName: periodeName,
        months: config.months,
        divisor: config.divisor,
        activeUnits,
        programs,
        monthlyData,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Rekap_Compliance_${year}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("ERROR GET /api/reports/compliance/export", error);

    return NextResponse.json(errorResponse("Gagal export data", 500), {
      status: 500,
    });
  }
}

// Helper getactiveUnits()

interface ActiveUnit {
  id: string;
  name: string;
  type: string;
  wilayah: string;
  parentId?: string | null;
}

async function getActiveUnits(params: {
  kanwilId: string;
  kancabId: string;
  divisiId: string;
  unitTypeFilter: string;
  user: any;
}): Promise<ActiveUnit[]> {
  const { kanwilId, kancabId, divisiId, unitTypeFilter, user } = params;
  const hasPIC = { users: { some: { role: "PIC" as const } } };

  let activeUnits: ActiveUnit[] = [];

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

  return activeUnits;
}

// Helper getMonthlySubmissions()
interface MonthlySubmission {
  unitId: string;
  programId: string;
  bulan: number;
  jumlah: number;
}

async function getMonthlySubmissions(
  year: number,
  activeUnits: ActiveUnit[],
  programId: string,
): Promise<MonthlySubmission[]> {
  const unitIds = activeUnits.map((u) => u.id);

  if (unitIds.length === 0) return [];

  const result = await prisma.$queryRaw<MonthlySubmission[]>`
    SELECT
      "unitId",
      "programId",
      EXTRACT(MONTH FROM "tanggalKegiatan")::int AS "bulan",
      COUNT(*)::int AS "jumlah"
    FROM "ActivityReport"
    WHERE
      "status" = 'APPROVED'
      AND "unitId" IS NOT NULL
      AND "unitId" IN (${Prisma.join(unitIds)})
      AND EXTRACT(YEAR FROM "tanggalKegiatan") = ${year}
      ${programId !== "ALL" ? Prisma.sql`AND "programId" = ${programId}` : Prisma.empty}
    GROUP BY "unitId", "programId", "bulan"
    ORDER BY "unitId", "programId", "bulan"
  `;

  return result;
}

// Helper lookup
function getSubmissionCount(
  monthlyData: MonthlySubmission[],
  unitId: string,
  programId: string,
  month: number,
): number {
  return (
    monthlyData.find(
      (d) =>
        d.unitId === unitId && d.programId === programId && d.bulan === month,
    )?.jumlah ?? 0
  );
}

// Helper buildSheet()
interface BuildSheetParams {
  sheetName: string;
  months: readonly number[];
  divisor: number;
  activeUnits: ActiveUnit[];
  programs: ProgramBudaya[];
  monthlyData: MonthlySubmission[];
}

function buildSheet(workbook: ExcelJS.Workbook, params: BuildSheetParams) {
  const { sheetName, months, divisor, activeUnits, programs, monthlyData } =
    params;

  const ws = workbook.addWorksheet(sheetName);
  const monthCount = months.length;

  const headerRow1 = [
    "NO",
    "KANWIL",
    "PROGRAM BUDAYA",
    `TARGET/ ${divisor === 4 ? "TRIWULAN" : "SEMESTER"}`,
  ];

  headerRow1.push("REALISASI");
  for (let i = 1; i < monthCount; i++) {
    headerRow1.push("");
  }

  headerRow1.push(sheetName);
  headerRow1.push("% REALISASI");
  headerRow1.push("% RATA-RATA");
  headerRow1.push("TARGET KINERJA");
  headerRow1.push("% CAPAIAN KINERJA");

  const row1 = ws.addRow(headerRow1);
  row1.font = { bold: true };
  row1.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(1, 5, 1, 4 + monthCount);

  const headerRow2 = ["", "", "", ""];
  months.forEach((m) => headerRow2.push(MONTH_NAMES_ID[m - 1]));

  headerRow2.push("", "", "", "", "");

  const row2 = ws.addRow(headerRow2);
  row2.font = { bold: true };
  row2.alignment = { horizontal: "center" };

  ws.mergeCells(1, 1, 2, 1); // NO
  ws.mergeCells(1, 2, 2, 2); // KANWIL
  ws.mergeCells(1, 3, 2, 3); // PROGRAM BUDAYA
  ws.mergeCells(1, 4, 2, 4); // TARGET

  const afterMonthsCol = 5 + monthCount;
  ws.mergeCells(1, afterMonthsCol, 2, afterMonthsCol); // TW/SEM total
  ws.mergeCells(1, afterMonthsCol + 1, 2, afterMonthsCol + 1); // % REALISASI
  ws.mergeCells(1, afterMonthsCol + 2, 2, afterMonthsCol + 2); // % RATA-RATA
  ws.mergeCells(1, afterMonthsCol + 3, 2, afterMonthsCol + 3); // TARGET KINERJA
  ws.mergeCells(1, afterMonthsCol + 4, 2, afterMonthsCol + 4); // % CAPAIAN

  const groupedUnits = groupUnitsHierarchically(activeUnits);

  let kanwilNo = 0;

  for (const group of groupedUnits) {
    kanwilNo++;
    const unitsInGroup = [group.kanwil, ...group.kancabs].filter(Boolean);

    for (const unit of unitsInGroup) {
      if (!unit) continue;
      const isKanwil = unit.type === "KANTOR_WILAYAH";

      // Hitung compliance per program untuk unit ini
      const programComplianceList = programs.map((prog) => {
        const target = Math.round(prog.frequency / divisor);
        const monthlyValues = months.map((m) =>
          getSubmissionCount(monthlyData, unit.id, prog.id, m),
        );
        const totalRealisasi = monthlyValues.reduce((a, b) => a + b, 0);
        const pctRealisasi = target > 0 ? totalRealisasi / target : 0;
        return { prog, target, monthlyValues, totalRealisasi, pctRealisasi };
      });

      // % rata-rata semua program untuk unit ini
      const avgPct =
        programComplianceList.length > 0
          ? programComplianceList.reduce((sum, p) => sum + p.pctRealisasi, 0) /
            programComplianceList.length
          : 0;

      // TARGET KINERJA fix 0.9 (90%)
      const targetKinerja = 0.9;
      const pctCapaian = targetKinerja > 0 ? avgPct / targetKinerja : 0;

      // Tulis 1 row per program
      programComplianceList.forEach((pc, idx) => {
        const rowData: (string | number)[] = [];

        // NO — hanya di baris pertama kanwil
        rowData.push(idx === 0 && isKanwil ? kanwilNo : "");

        // KANWIL — nama unit (hanya di baris pertama)
        rowData.push(idx === 0 ? unit.name : "");

        // PROGRAM BUDAYA
        rowData.push(pc.prog.name);

        // TARGET/TW
        rowData.push(pc.target);

        // REALISASI per bulan
        pc.monthlyValues.forEach((v) => rowData.push(v));

        // TOTAL TW/Semester
        rowData.push(pc.totalRealisasi);

        // % REALISASI
        rowData.push(pc.pctRealisasi);

        // % RATA-RATA — hanya di baris pertama per unit
        rowData.push(idx === 0 ? avgPct : "");

        // TARGET KINERJA — hanya di baris pertama per unit
        rowData.push(idx === 0 ? targetKinerja : "");

        // % CAPAIAN KINERJA — hanya di baris pertama per unit
        rowData.push(idx === 0 ? pctCapaian : "");

        ws.addRow(rowData);
      });
    }
  }

  ws.getColumn(1).width = 5; // NO
  ws.getColumn(2).width = 30; // KANWIL
  ws.getColumn(3).width = 20; // PROGRAM BUDAYA
  ws.getColumn(4).width = 15; // TARGET

  for (let i = 0; i < monthCount; i++) {
    ws.getColumn(5 + i).width = 12;
  }

  ws.getColumn(afterMonthsCol).width = 12; // Total
  ws.getColumn(afterMonthsCol + 1).width = 14; // % Realisasi
  ws.getColumn(afterMonthsCol + 2).width = 14; // % Rata-rata
  ws.getColumn(afterMonthsCol + 3).width = 15; // Target Kinerja
  ws.getColumn(afterMonthsCol + 4).width = 18; // % Capaian Kinerja

  const pctCols = [afterMonthsCol + 1, afterMonthsCol + 2, afterMonthsCol + 4];
  pctCols.forEach((colIdx) => {
    ws.getColumn(colIdx).numFmt = "0.00%";
  });
}

// helper groupunitshierarchi

interface UnitGroup {
  kanwil: ActiveUnit | null;
  kancabs: ActiveUnit[];
}

function groupUnitsHierarchically(units: ActiveUnit[]): UnitGroup[] {
  const kanwils = units.filter((u) => u.type === "KANTOR_WILAYAH");
  const kancabs = units.filter((u) => u.type === "KANTOR_CABANG");
  const divisis = units.filter((u) => u.type === "DIVISI");

  const groups: UnitGroup[] = [];

  for (const kanwil of kanwils) {
    groups.push({
      kanwil,
      kancabs: kancabs.filter((k) => k.parentId === kanwil.id),
    });
  }

  const orphanKancabs = kancabs.filter(
    (k) => !kanwils.some((kw) => kw.id === k.parentId),
  );

  if (orphanKancabs.length > 0) {
    groups.push({
      kanwil: null,
      kancabs: orphanKancabs,
    });
  }

  for (const divisi of divisis) {
    groups.push({ kanwil: divisi, kancabs: [] });
  }

  return groups;
}
