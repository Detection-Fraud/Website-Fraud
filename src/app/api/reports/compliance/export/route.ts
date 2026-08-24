import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { MONTHS_NAMES_ID, PERIODE_CONFIG } from "@/lib/api/constants";
import { resolveScope, type ActiveUnit } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@generated/prisma";
import ExcelJS from "exceljs";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );
    const programId = searchParams.get("programId") || "ALL";
    const kanwilId = searchParams.get("kanwilId") || "ALL";
    const kancabId = searchParams.get("kancabId") || "ALL";
    const divisiId = searchParams.get("divisiId") || "ALL";
    const unitTypeFilter = searchParams.get("unitType") || "NASIONAL";

    const { activeUnits } = await resolveScope(session.user, {
      kanwilId,
      kancabId,
      divisiId,
      unitTypeFilter,
    });

    const categories = await prisma.programCategory.findMany({
      where: {
        targetUnit: "KEGIATAN",
        ...(programId !== "ALL" && { id: programId }),
      },
      include: {
        programs: {
          where: {
            isActive: true,
          },
          select: { id: true, tw: true, frequency: true },
          orderBy: { tw: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const allProgramIds = categories.flatMap((c) =>
      c.programs.map((p) => p.id),
    );

    const monthlyData = await getMonthlySubmissions(
      year,
      activeUnits,
      allProgramIds,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Cubic - BULOG";
    workbook.created = new Date();

    for (const [periodeName, config] of Object.entries(PERIODE_CONFIG)) {
      buildSheet(workbook, {
        sheetName: periodeName,
        months: config.months,
        activeUnits,
        categories,
        monthlyData,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const sanitize = (str: string) =>
      str
        .replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, "_")
        .replace(/_+/g, "_")
        .trim();

    let scopeLabel = "Nasional";

    if (session.user.role === "PIC") {
      const unitName = session.user.unitName ?? session.user.unitId ?? "Unit";
      scopeLabel = sanitize(unitName);
    } else if (session.user.role === "ADMIN") {
      if (kancabId !== "ALL") {
        const kancabUnit = activeUnits.find((u) => u.id === kancabId);
        if (kancabUnit) scopeLabel = sanitize(kancabUnit.name);
      } else if (kanwilId !== "ALL") {
        const kanwilUnit = activeUnits.find(
          (u) => u.id === kanwilId || u.type === "KANTOR_WILAYAH",
        );
        if (kanwilUnit) scopeLabel = sanitize(kanwilUnit.name);
      } else if (divisiId !== "ALL") {
        const divisiUnit = activeUnits.find((u) => u.id === divisiId);
        if (divisiUnit) scopeLabel = sanitize(divisiUnit.name);
      }
    }

    const fileName = `Rekap_Program_Budaya_${scopeLabel}_${year}.xlsx`;

    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
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
  programIds: string[],
): Promise<MonthlySubmission[]> {
  const unitIds = activeUnits.map((u) => u.id);

  if (unitIds.length === 0 || programIds.length === 0) return [];

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
      ${programIds.length > 0 ? Prisma.sql`AND "programId" IN (${Prisma.join(programIds)})` : Prisma.empty}
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

interface CategoryWithTwPrograms {
  id: string;
  name: string;
  programs: {
    id: string;
    tw: number | null;
    frequency: number;
  }[];
}

interface BuildSheetParams {
  sheetName: string;
  months: readonly number[];
  activeUnits: ActiveUnit[];
  categories: CategoryWithTwPrograms[];
  monthlyData: MonthlySubmission[];
}

function buildSheet(workbook: ExcelJS.Workbook, params: BuildSheetParams) {
  const { sheetName, months, activeUnits, categories, monthlyData } = params;

  const ws = workbook.addWorksheet(sheetName);
  const monthCount = months.length;

  const isTW = ["TW I", "TW II", "TW III", "TW IV"].includes(sheetName);

  const headerRow1 = [
    "NO",
    "KANWIL",
    "PROGRAM BUDAYA",
    isTW ? "TARGET/ TRIWULAN" : "TARGET/ SEMESTER",
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

      // Tentukan TW number dari sheetName (null = semester sheet)
      const twNumber: number | null =
        { "TW I": 1, "TW II": 2, "TW III": 3, "TW IV": 4 }[sheetName] ?? null;
      const semesterTWs: Record<string, number[]> = {
        "SEMESTER I": [1, 2],
        "SEMESTER II": [3, 4],
      };
      const semesterTWList = semesterTWs[sheetName] ?? null;

      const programComplianceList = categories
        .map((cat) => {
          let progIds: string[];
          let target: number;

          if (twNumber != null) {
            // Sheet TW: cari program dengan tw=twNumber
            const prog = cat.programs.find((p) => p.tw === twNumber);
            if (!prog) return null; // category tidak aktif di TW ini
            progIds = [prog.id];
            target = prog.frequency;
          } else if (semesterTWList) {
            // Sheet Semester: ambil semua TW dalam semester
            const semProgs = cat.programs.filter(
              (p) => p.tw != null && semesterTWList.includes(p.tw),
            );
            if (semProgs.length === 0) return null;
            progIds = semProgs.map((p) => p.id);
            target = semProgs.reduce((s, p) => s + p.frequency, 0);
          } else {
            // Fallback: semua program di category
            progIds = cat.programs.map((p) => p.id);
            target = cat.programs.reduce((s, p) => s + p.frequency, 0);
          }

          const monthlyValues = months.map((m) =>
            progIds.reduce(
              (sum, pid) =>
                sum + getSubmissionCount(monthlyData, unit.id, pid, m),
              0,
            ),
          );
          const totalRealisasi = monthlyValues.reduce((a, b) => a + b, 0);
          const pctRealisasi = target > 0 ? totalRealisasi / target : 0;
          return {
            name: cat.name,
            target,
            monthlyValues,
            totalRealisasi,
            pctRealisasi,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

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
        rowData.push(pc.name);
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

  const pctCols = [
    afterMonthsCol + 1,
    afterMonthsCol + 2,
    afterMonthsCol + 3,
    afterMonthsCol + 4,
  ];
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
