import { auth } from "@/auth";
import { errorResponse } from "@/lib/response";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const user = session?.user;

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(errorResponse("Forbidden", 403), { status: 403 });
  }

  const wb = XLSX.utils.book_new();

  const templateHeaders = [
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

  const exampleRow = {
    NIP: "267426006",
    NAMA: "SYAMSU HIDAYAT",
    JAB_LKP: "ANALIS KEBIJAKAN",
    KODE_DOLOG: "00",
    KODE_SUBDOLOG: "00",
    KODE_ORG: "E00000",
    NAMA_ORG: "PERUM BULOG",
    NAMA_SATKER: "KANTOR PUSAT PERUM BULOG",
    NAMA_INDUK: "",
  };

  const exampleRowKancab = {
    NIP: "110015001",
    NAMA: "BUDI SANTOSO",
    JAB_LKP: "KEPALA CABANG",
    KODE_DOLOG: "01",
    KODE_SUBDOLOG: "01",
    KODE_ORG: "",
    NAMA_ORG: "KANTOR CABANG BANDA ACEH",
    NAMA_SATKER: "KANTOR CABANG BANDA ACEH",
    NAMA_INDUK: "KANTOR WILAYAH ACEH",
  };

  const ws = XLSX.utils.json_to_sheet([exampleRow, exampleRowKancab], {
    header: templateHeaders,
  });

  ws["!cols"] = [
    { wch: 14 }, // NIP
    { wch: 30 }, // NAMA
    { wch: 40 }, // JAB_LKP
    { wch: 14 }, // KODE_DOLOG
    { wch: 16 }, // KODE_SUBDOLOG
    { wch: 12 }, // KODE_ORG
    { wch: 35 }, // NAMA_ORG
    { wch: 35 }, // NAMA_SATKER
    { wch: 35 }, // NAMA_INDUK
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Template");

  const panduanData = [
    ["PANDUAN PENGISIAN TEMPLATE IMPORT KARYAWAN"],
    [],
    ["Kolom", "Keterangan", "Wajib?", "Contoh"],
    ["NIP", "Nomor Induk Pegawai unik karyawan", "Ya", "267426006"],
    ["NAMA", "Nama lengkap karyawan", "Ya", "SYAMSU HIDAYAT"],
    ["JAB_LKP", "Jabatan lengkap karyawan", "Ya", "ANALIS KEBIJAKAN"],
    [
      "KODE_DOLOG",
      "Kode Dolog (2 digit). Isi '00' untuk Kantor Pusat/Divisi",
      "Ya",
      "01 / 00",
    ],
    [
      "KODE_SUBDOLOG",
      "Kode Sub-Dolog (2 digit). Isi '00' untuk Kantor Pusat/Divisi",
      "Ya",
      "01 / 00",
    ],
    [
      "KODE_ORG",
      "Kode Organisasi. Wajib untuk karyawan Kantor Pusat (KODE_DOLOG=00)",
      "KP: Ya",
      "E33000 / E00000",
    ],
    [
      "NAMA_ORG",
      "Nama unit/organisasi. Dipakai sebagai fallback jika KODE_ORG tidak dikenal",
      "Disarankan",
      "PERUM BULOG",
    ],
    [
      "NAMA_SATKER",
      "Nama satuan kerja. Fallback ke-2 untuk resolusi unit",
      "Disarankan",
      "KANTOR PUSAT PERUM BULOG",
    ],
    [
      "NAMA_INDUK",
      "Nama unit induk. Fallback ke-3 untuk resolusi unit",
      "Opsional",
      "",
    ],
    [],
    ["CATATAN PENTING"],
    [
      "1. Pastikan file berisi SEMUA karyawan aktif. Karyawan yang tidak ada di file akan dinonaktifkan.",
    ],
    ["2. NIP harus unik. Duplikat NIP dalam satu file akan dianggap error."],
    [
      "3. Untuk karyawan Kanwil/Kancab: isi KODE_DOLOG dan KODE_SUBDOLOG dengan benar.",
    ],
    [
      "4. Untuk karyawan Kantor Pusat: isi KODE_DOLOG=00, KODE_SUBDOLOG=00, dan KODE_ORG.",
    ],
    [
      "5. Jika KODE_ORG tidak dikenal, sistem akan mencoba cocokkan via NAMA_ORG → NAMA_SATKER → NAMA_INDUK.",
    ],
  ];

  const wsPanduan = XLSX.utils.aoa_to_sheet(panduanData);
  wsPanduan["!cols"] = [{ wch: 16 }, { wch: 60 }, { wch: 10 }, { wch: 25 }];

  XLSX.utils.book_append_sheet(wb, wsPanduan, "Panduan");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="Template_Import_Karyawan.xlsx"',
    },
  });
}
