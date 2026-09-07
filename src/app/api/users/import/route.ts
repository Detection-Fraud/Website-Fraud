import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { errorResponse, successResponse } from "@/lib/response";
import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";

const REQUIRED_HEADERS = [
  "NIP",
  "NAMA",
  "JAB_LKP",
  "KODE_DOLOG",
  "KODE_SUBDOLOG",
  "KODE_ORG",
  "NAMA_ORG",
  "NAMA_SATKER",
  "NAMA_INDUK",
];

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, {
    keyPrefix: "users-import-preview",
    max: 3,
  });

  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  try {
    await requireAdmin();

    const action = new URL(req.url).searchParams.get("action");

    if (action === "commit") {
      return NextResponse.json(
        errorResponse(
          "Import karyawan legacy hanya menyediakan preview; gunakan sinkronisasi Employee resmi",
          410,
        ),
        { status: 410 },
      );
    }

    if (action !== "preview") {
      return NextResponse.json(
        errorResponse("Action tidak valid. Gunakan ?action=preview", 400),
        { status: 400 },
      );
    }

    const file = (await req.formData()).get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(errorResponse("File tidak ditemukan", 400), {
        status: 400,
      });
    }

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);

    const worksheet = workbook.worksheets[0];

    if (!worksheet || worksheet.rowCount < 1) {
      return NextResponse.json(
        errorResponse("File Excel kosong atau tidak memiliki header", 400),
        { status: 400 },
      );
    }

    const headers: string[] = [];

    worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
      headers.push(
        String(cell.value ?? "")
          .trim()
          .toUpperCase(),
      );
    });

    const missingHeaders = REQUIRED_HEADERS.filter(
      (header) => !headers.includes(header),
    );

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        errorResponse(
          "Header tidak ditemukan: " + missingHeaders.join(", "),
          400,
        ),
        { status: 400 },
      );
    }

    const rows: Array<{
      id: number;
      nip: string;
      nama: string;
      jabatan: string;
      unitKerja: string;
      unitId: null;
      wilayah: string;
      status: "error";
      errorMsg: string;
      mutasiInfo: null;
    }> = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
      if (rowIndex === 1) return;

      const values = headers.map((_, index) =>
        String(row.getCell(index + 1).value ?? "").trim(),
      );

      rows.push({
        id: rowIndex - 2,
        nip: values[headers.indexOf("NIP")] ?? "",
        nama: values[headers.indexOf("NAMA")] ?? "",
        jabatan: values[headers.indexOf("JAB_LKP")] ?? "",
        unitKerja: "-",
        unitId: null,
        wilayah: "-",
        status: "error",
        errorMsg: "Preview legacy tidak memvalidasi atau menulis Employee/User",
        mutasiInfo: null,
      });
    });

    return NextResponse.json(
      successResponse(
        {
          stats: {
            total: rows.length,
            baru: 0,
            mutasi: 0,
            tidakBerubah: 0,
            error: rows.length,
          },
          rows,
        },
        "Preview legacy digenerate; tidak ada perubahan data",
      ),
    );
  } catch (error) {
    return handleApiError(error, "POST /api/users/import");
  }
}
