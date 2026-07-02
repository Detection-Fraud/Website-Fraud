import { getActiveUnits, type ActiveUnit } from "@/lib/api/active-units";
import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { MONTHS_NAMES_ID, PERIODE_CONFIG } from "@/lib/api/constants";
import { prisma } from "@/lib/prisma";
import { Prisma, ProgramBudaya } from "@generated/prisma";
import ExcelJS from "exceljs";

export async function GET(req: Request) {
  try {
    const session = await requireAdmin();

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
    return handleApiError(error, "GET /api/reports/compliance/export");
  }
}

// ── Helper: getMonthlySubmissions ──

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

// ── Helper: getSubmissionCount ──
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

// ── Helper: buildSheet ──

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
  months.forEach((m) => headerRow2.push(MONTHS_NAMES_ID[m - 1]));

  headerRow2.push("", "", "", "", "");

  const row2 = ws.addRow(headerRow2);
  row2.font = { bold: true };
  row2.alignment = { horizontal: "center" };

  ws.mergeCells(1, 1, 2, 1);
  ws.mergeCells(1, 2, 2, 2);
  ws.mergeCells(1, 3, 2, 3);
  ws.mergeCells(1, 4, 2, 4);

  const afterMonthsCol = 5 + monthCount;
  ws.mergeCells(1, afterMonthsCol, 2, afterMonthsCol);
  ws.mergeCells(1, afterMonthsCol + 1, 2, afterMonthsCol + 1);
  ws.mergeCells(1, afterMonthsCol + 2, 2, afterMonthsCol + 2);
  ws.mergeCells(1, afterMonthsCol + 3, 2, afterMonthsCol + 3);
  ws.mergeCells(1, afterMonthsCol + 4, 2, afterMonthsCol + 4);

  const groupedUnits = groupUnitsHierarchically(activeUnits);

  let kanwilNo = 0;

  for (const group of groupedUnits) {
    kanwilNo++;
    const unitsInGroup = [group.kanwil, ...group.kancabs].filter(Boolean);

    for (const unit of unitsInGroup) {
      if (!unit) continue;
      const isKanwil = unit.type === "KANTOR_WILAYAH";

      const programComplianceList = programs.map((prog) => {
        const target = Math.round(prog.frequency / divisor);
        const monthlyValues = months.map((m) =>
          getSubmissionCount(monthlyData, unit.id, prog.id, m),
        );
        const totalRealisasi = monthlyValues.reduce((a, b) => a + b, 0);
        const pctRealisasi = target > 0 ? totalRealisasi / target : 0;
        return { prog, target, monthlyValues, totalRealisasi, pctRealisasi };
      });

      const avgPct =
        programComplianceList.length > 0
          ? programComplianceList.reduce((sum, p) => sum + p.pctRealisasi, 0) /
            programComplianceList.length
          : 0;

      const targetKinerja = 0.9;
      const pctCapaian = targetKinerja > 0 ? avgPct / targetKinerja : 0;

      programComplianceList.forEach((pc, idx) => {
        const rowData: (string | number)[] = [];

        rowData.push(idx === 0 && isKanwil ? kanwilNo : "");
        rowData.push(idx === 0 ? unit.name : "");
        rowData.push(pc.prog.name);
        rowData.push(pc.target);

        pc.monthlyValues.forEach((v) => rowData.push(v));

        rowData.push(pc.totalRealisasi);
        rowData.push(pc.pctRealisasi);
        rowData.push(idx === 0 ? avgPct : "");
        rowData.push(idx === 0 ? targetKinerja : "");
        rowData.push(idx === 0 ? pctCapaian : "");

        ws.addRow(rowData);
      });
    }
  }

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 15;

  for (let i = 0; i < monthCount; i++) {
    ws.getColumn(5 + i).width = 12;
  }

  ws.getColumn(afterMonthsCol).width = 12;
  ws.getColumn(afterMonthsCol + 1).width = 14;
  ws.getColumn(afterMonthsCol + 2).width = 14;
  ws.getColumn(afterMonthsCol + 3).width = 15;
  ws.getColumn(afterMonthsCol + 4).width = 18;

  const pctCols = [afterMonthsCol + 1, afterMonthsCol + 2, afterMonthsCol + 4];
  pctCols.forEach((colIdx) => {
    ws.getColumn(colIdx).numFmt = "0.00%";
  });
}

// ── Helper: groupUnitsHierarchically ──

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
