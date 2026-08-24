import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAdmin();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "DICE BULOG";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Template");
    ws.columns = [
      { header: "NIP", key: "NIP", width: 14 },
      { header: "NAMA", key: "NAMA", width: 30 },
      { header: "JAB_LKP", key: "JAB_LKP", width: 40 },
      { header: "KODE_DOLOG", key: "KODE_DOLOG", width: 14 },
      { header: "KODE_SUBDOLOG", key: "KODE_SUBDOLOG", width: 16 },
      { header: "KODE_ORG", key: "KODE_ORG", width: 12 },
      { header: "NAMA_ORG", key: "NAMA_ORG", width: 35 },
      { header: "NAMA_SATKER", key: "NAMA_SATKER", width: 35 },
      { header: "NAMA_INDUK", key: "NAMA_INDUK", width: 35 },
    ];
    ws.getRow(1).font = { bold: true };

    ws.addRow({
      NIP: "267426006",
      NAMA: "RONI PARULIAN",
      JAB_LKP: "ANALIS KEBIJAKAN",
      KODE_DOLOG: "00",
      KODE_SUBDOLOG: "00",
      KODE_ORG: "E00000",
      NAMA_ORG: "PERUM BULOG",
      NAMA_SATKER: "KANTOR PUSAT PERUM BULOG",
      NAMA_INDUK: "",
    });
    ws.addRow({
      NIP: "110015001",
      NAMA: "BUDI SANTOSO",
      JAB_LKP: "KEPALA CABANG",
      KODE_DOLOG: "01",
      KODE_SUBDOLOG: "01",
      KODE_ORG: "",
      NAMA_ORG: "KANTOR CABANG BANDA ACEH",
      NAMA_SATKER: "KANTOR CABANG BANDA ACEH",
      NAMA_INDUK: "KANTOR WILAYAH ACEH",
    });

    const wsPanduan = workbook.addWorksheet("Panduan");
    wsPanduan.columns = [
      { header: "Kolom", key: "kolom", width: 16 },
      { header: "Keterangan", key: "keterangan", width: 60 },
      { header: "Wajib?", key: "wajib", width: 10 },
      { header: "Contoh", key: "contoh", width: 25 },
    ];
    wsPanduan.getRow(1).font = { bold: true };
    [
      {
        kolom: "NIP",
        keterangan: "Nomor Induk Pegawai unik karyawan",
        wajib: "Ya",
        contoh: "267426006",
      },
      {
        kolom: "NAMA",
        keterangan: "Nama lengkap karyawan",
        wajib: "Ya",
        contoh: "SYAMSU HIDAYAT",
      },
      {
        kolom: "JAB_LKP",
        keterangan: "Jabatan lengkap karyawan",
        wajib: "Ya",
        contoh: "ANALIS KEBIJAKAN",
      },
      {
        kolom: "KODE_DOLOG",
        keterangan: "Kode Dolog 2 digit. Isi 00 untuk Kantor Pusat",
        wajib: "Ya",
        contoh: "01 / 00",
      },
      {
        kolom: "KODE_SUBDOLOG",
        keterangan: "Kode Sub-Dolog 2 digit",
        wajib: "Ya",
        contoh: "01 / 00",
      },
      {
        kolom: "KODE_ORG",
        keterangan: "Kode Organisasi. Wajib untuk KP (KODE_DOLOG=00)",
        wajib: "KP: Ya",
        contoh: "E33000",
      },
      {
        kolom: "NAMA_ORG",
        keterangan:
          "Nama unit/organisasi. Fallback jika KODE_ORG tidak dikenal",
        wajib: "Disarankan",
        contoh: "PERUM BULOG",
      },
      {
        kolom: "NAMA_SATKER",
        keterangan: "Nama satuan kerja. Fallback ke-2",
        wajib: "Disarankan",
        contoh: "KANTOR PUSAT PERUM BULOG",
      },
      {
        kolom: "NAMA_INDUK",
        keterangan: "Nama unit induk. Fallback ke-3",
        wajib: "Opsional",
        contoh: "",
      },
    ].forEach((row) => wsPanduan.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="Template_Import_Karyawan.xlsx"',
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/users/import/template");
  }
}
