import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// ──────────────────────────────────────────────────────────────────
// Helper: Map semua unit dari DB
// Mendukung 3 strategi lookup untuk karyawan Kantor Pusat (KODE_DOLOG=00):
//   1. Exact match KODE_ORG        → unitByExactOrg
//   2. Prefix 3-char KODE_ORG      → unitByOrgPrefix
//   3. Nama unit (NAMA_ORG kolom)  → unitByName
// ──────────────────────────────────────────────────────────────────
async function getUnitMaps() {
  const allUnits = await prisma.unit.findMany({
    select: {
      id: true,
      name: true,
      kodeDolog: true,
      kodeSubdolog: true,
      kodeOrg: true,
      type: true,
    },
  });

  const unitByDologMap = new Map<string, (typeof allUnits)[0]>();
  // Lookup 1: exact full kodeOrg (e.g. "E00000", "E33000")
  const unitByExactOrg = new Map<string, (typeof allUnits)[0]>();
  // Lookup 2, 3, 4: nama unit UPPERCASE dari berbagai kolom
  const unitByName = new Map<string, (typeof allUnits)[0]>();
  const unitById = new Map<string, (typeof allUnits)[0]>();

  for (const unit of allUnits) {
    unitByDologMap.set(`${unit.kodeDolog}-${unit.kodeSubdolog}`, unit);
    unitById.set(unit.id, unit);
    unitByName.set(unit.name.trim().toUpperCase(), unit);
    if (unit.kodeOrg) {
      unitByExactOrg.set(unit.kodeOrg, unit);
    }
  }

  return { unitByDologMap, unitByExactOrg, unitByName, unitById };
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ═══════════════════════════════════════════════════════════
    // ACTION: PREVIEW — Menerima File Excel
    // ═══════════════════════════════════════════════════════════
    if (action === "preview") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return NextResponse.json(errorResponse("File tidak ditemukan", 400), {
          status: 400,
        });
      }

      // Parse Excel
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer);

      // HEADER VALIDATION
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rawHeaders = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        range: 0,
      });

      if (!rawHeaders.length || !rawHeaders[0]) {
        return NextResponse.json(
          errorResponse("File Excel kosong atau tidak memiliki header", 400),
          { status: 400 },
        );
      }

      const headers = rawHeaders[0].map((h: any) =>
        String(h ?? "")
          .trim()
          .toUpperCase(),
      );

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

      // Validasi apakah semua header wajib ada
      const missingHeaders = REQUIRED_HEADERS.filter(
        (required) => !headers.includes(required),
      );

      if (missingHeaders.length > 0) {
        return NextResponse.json(
          errorResponse(
            `Header tidak ditemukan: ${missingHeaders.join(", ")}`,
            400,
          ),
          { status: 400 },
        );
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      // ── Load data master PARALEL ──────────────────────────────
      const [
        { unitByDologMap, unitByExactOrg, unitByName, unitById },
        existingUsers,
      ] = await Promise.all([
        getUnitMaps(),
        // Ambil semua SSO user aktif untuk deteksi mutasi
        prisma.user.findMany({
          where: { authProvider: "SSO" },
          select: {
            id: true,
            username: true, // = NIP
            name: true,
            unitId: true,
            isActive: true,
          },
        }),
      ]);

      // Map NIP → user yang sudah ada di DB
      const existingByNip = new Map(existingUsers.map((u) => [u.username, u]));

      // ── Proses setiap baris Excel ─────────────────────────────
      const previewRows = rows.map((row, index) => {
        const nip = String(row["NIP"] ?? "").trim();
        const nama = String(row["NAMA"] ?? "").trim();
        const dolog = String(row["KODE_DOLOG"] ?? "").trim();
        const subdolog = String(row["KODE_SUBDOLOG"] ?? "").trim();
        const kodeOrg = String(row["KODE_ORG"] ?? "").trim();
        const jabatan = String(row["JAB_LKP"] ?? row["JABATAN"] ?? "").trim();
        // Kolom nama unit digunakan sebagai fallback hierarki untuk karyawan Kantor Pusat.
        // File Excel menggunakan kode lama (D-series) yang berbeda dengan kode DB (E-series),
        // sehingga exact match sering gagal. Tiga kolom nama dipakai sebagai fallback:
        //   NAMA_ORG    = nama sub-unit (paling spesifik, tapi sering sub-level)
        //   NAMA_SATKER = nama satuan kerja (lebih tinggi, sering cocok ke DB)
        //   NAMA_INDUK  = nama unit induk (paling umum)
        const namaOrg = String(row["NAMA_ORG"] ?? "")
          .trim()
          .toUpperCase();
        const namaSatker = String(row["NAMA_SATKER"] ?? "")
          .trim()
          .toUpperCase();
        const namaInduk = String(row["NAMA_INDUK"] ?? "")
          .trim()
          .toUpperCase();

        // Resolusi unit dari kode
        type UnitType =
          Awaited<ReturnType<typeof getUnitMaps>>["unitById"] extends Map<
            string,
            infer U
          >
            ? U
            : never;
        let unit: UnitType | null = null;

        if (dolog !== "00") {
          // ── Karyawan Kanwil / Kancab — lookup by kodeDolog-kodeSubdolog ──
          unit =
            unitByDologMap.get(`${dolog}-${subdolog}`) ??
            unitByDologMap.get(`${dolog}-00`) ??
            null;
        } else {
          // ── Karyawan Kantor Pusat — hierarki 4 level ─────────────────────
          // Tidak pakai prefix 3-char karena prefix "E00" collision: semua
          // Kancab pakai kodeOrg "E00xxx" sehingga prefix tidak bisa membedakan.
          unit =
            // 1. Exact full kodeOrg (e.g. "E00000", "E33000" langsung ketemu)
            (kodeOrg ? unitByExactOrg.get(kodeOrg) : undefined) ??
            // 2. Nama dari kolom NAMA_ORG (e.g. "PERUM BULOG", "DIVISI SDM")
            (namaOrg ? unitByName.get(namaOrg) : undefined) ??
            // 3. Nama dari kolom NAMA_SATKER (e.g. "KANTOR PUSAT PERUM BULOG" → "PERUM BULOG")
            (namaSatker ? unitByName.get(namaSatker) : undefined) ??
            // 4. Nama dari kolom NAMA_INDUK (fallback terakhir)
            (namaInduk ? unitByName.get(namaInduk) : undefined) ??
            null;
        }

        // ── Validasi field wajib (error dulu sebelum cek mutasi) ─
        if (!nip) {
          return {
            id: index,
            nip,
            nama,
            jabatan,
            unitKerja: "-",
            unitId: null,
            wilayah: "-",
            status: "error" as const,
            errorMsg: "NIP kosong",
            mutasiInfo: null,
          };
        }
        if (!nama) {
          return {
            id: index,
            nip,
            nama,
            jabatan,
            unitKerja: "-",
            unitId: null,
            wilayah: "-",
            status: "error" as const,
            errorMsg: "Nama kosong",
            mutasiInfo: null,
          };
        }
        if (!unit) {
          return {
            id: index,
            nip,
            nama,
            jabatan,
            unitKerja: "-",
            unitId: null,
            wilayah: "-",
            status: "error" as const,
            errorMsg: "Kode unit tidak terpetakan (cek KODE_DOLOG/KODE_ORG)",
            mutasiInfo: null,
          };
        }

        const unitKerja = unit.name;
        const unitId = unit.id;
        const wilayah = unit.type === "KANTOR_WILAYAH" ? unit.name : "-";

        // ── Cek apakah NIP sudah ada di DB ───────────────────────
        const existing = existingByNip.get(nip);

        if (!existing) {
          // NIP belum ada → karyawan baru
          return {
            id: index,
            nip,
            nama,
            jabatan,
            unitKerja,
            unitId,
            wilayah,
            status: "baru" as const,
            errorMsg: "",
            mutasiInfo: null,
          };
        }

        // NIP sudah ada — cek apakah unit berubah
        const unitBerubah = existing.unitId !== unitId;
        const namaBerubah = existing.name !== nama;

        if (unitBerubah) {
          // Unit berbeda → MUTASI — tampilkan warning
          const unitLamaObj = existing.unitId
            ? unitById.get(existing.unitId)
            : null;

          return {
            id: index,
            nip,
            nama,
            jabatan,
            unitKerja,
            unitId,
            wilayah,
            status: "mutasi" as const,
            errorMsg: "",
            mutasiInfo: {
              unitLama: unitLamaObj?.name ?? "(unit tidak diketahui)",
              unitIdLama: existing.unitId ?? null,
            },
          };
        }

        // Unit sama, mungkin nama berubah atau tidak berubah sama sekali
        if (namaBerubah) {
          return {
            id: index,
            nip,
            nama,
            jabatan,
            unitKerja,
            unitId,
            wilayah,
            status: "baru" as const, // Diperlakukan sama — akan diupdate
            errorMsg: "",
            mutasiInfo: null,
          };
        }

        // Benar-benar tidak ada perubahan
        return {
          id: index,
          nip,
          nama,
          jabatan,
          unitKerja,
          unitId,
          wilayah,
          status: "tidak_berubah" as const,
          errorMsg: "",
          mutasiInfo: null,
        };
      });

      // ── Hitung stats ──────────────────────────────────────────
      const stats = {
        total: previewRows.length,
        baru: previewRows.filter((r) => r.status === "baru").length,
        mutasi: previewRows.filter((r) => r.status === "mutasi").length,
        tidakBerubah: previewRows.filter((r) => r.status === "tidak_berubah")
          .length,
        error: previewRows.filter((r) => r.status === "error").length,
      };

      // ── Sort: Error & Mutasi di atas ──────────────────────────
      const statusWeight = {
        mutasi: 1,
        error: 2,
        baru: 3,
        tidak_berubah: 4,
      };

      const sortedRows = previewRows.sort(
        (a, b) => statusWeight[a.status] - statusWeight[b.status],
      );

      return NextResponse.json(
        successResponse({ stats, rows: sortedRows }, "Preview digenerate"),
      );
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: COMMIT — Menerima JSON Array
    // ═══════════════════════════════════════════════════════════
    if (action === "commit") {
      const body = await req.json();
      const rowsToImport = body.rows as Array<{
        status: "baru" | "mutasi" | "tidak_berubah" | "error";
        nip: string;
        nama: string;
        unitId: string | null;
      }>;

      if (!rowsToImport || !Array.isArray(rowsToImport)) {
        return NextResponse.json(errorResponse("Data tidak valid", 400), {
          status: 400,
        });
      }

      const existingUsers = await prisma.user.findMany({
        where: { authProvider: "SSO" },
        select: {
          id: true,
          username: true,
          name: true,
          unitId: true,
          isActive: true,
        },
      });
      const existingByNip = new Map(existingUsers.map((u) => [u.username, u]));
      const processedNips = new Set<string>();

      const validRows = rowsToImport.filter((row) => {
        if (row.status !== "error" && row.nip) {
          processedNips.add(row.nip);
        }
        return row.status !== "error" && row.status !== "tidak_berubah";
      });

      let createdCount = 0;
      let updatedCount = 0;

      await prisma.$transaction(async (tx) => {
        const toCreate = validRows.filter((r) => !existingByNip.has(r.nip));
        const toUpdate = validRows.filter((r) => existingByNip.has(r.nip));

        if (toCreate.length > 0) {
          const createData = toCreate.map((row) => ({
            username: row.nip,
            samlNameId: row.nip,
            name: row.nama,
            role: "VIEWER" as const,
            authProvider: "SSO",
            isActive: true,
            unitId: row.unitId,
          }));
          const created = await tx.user.createMany({
            data: createData,
          });
          createdCount = created.count;
        }

        if (toUpdate.length > 0) {
          await Promise.all(
            toUpdate.map((row) =>
              tx.user.update({
                where: { id: existingByNip.get(row.nip)!.id },
                data: { name: row.nama, unitId: row.unitId },
              }),
            ),
          );

          updatedCount = toUpdate.length;
        }
      });

      // ── Soft-delete user lama yang tidak ada di file ─────────
      let deactivatedCount = 0;
      const toDeactivate = [];
      for (const [nip, user] of existingByNip.entries()) {
        if (nip && !processedNips.has(nip) && user.isActive) {
          toDeactivate.push(user.id);
        }
      }

      if (toDeactivate.length > 0) {
        const deactivated = await prisma.user.updateMany({
          where: { id: { in: toDeactivate } },
          data: { isActive: false },
        });
        deactivatedCount = deactivated.count;
      }

      return NextResponse.json(
        successResponse(
          {
            created: createdCount,
            updated: updatedCount,
            deactivated: deactivatedCount,
          },
          "Import Selesai",
        ),
      );
    }

    return NextResponse.json(
      errorResponse(
        "Action tidak valid. Gunakan ?action=preview atau ?action=commit",
        400,
      ),
      { status: 400 },
    );
  } catch (error: unknown) {
    return handleApiError(error, "POST /api/users/import");
  }
}
