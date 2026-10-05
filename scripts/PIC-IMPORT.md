# Impor PIC melalui CLI

Script: `scripts/import-pic-users.ts`. Jalankan dari root repository.

Gunakan salinan Excel PIC yang sudah diisi: satu sheet `PIC`, header `NIP`
dan `UNIT_KERJA` di baris 5, data mulai baris 6. NIP wajib berupa teks.
Batas: 1.000 baris dan 5 MB. Nama unit harus sesuai penempatan Employee;
spasi dan kapitalisasi boleh berbeda. Kata `KANWIL` diterima sebagai
`KANTOR WILAYAH`, dan `KANCAB` sebagai `KANTOR CABANG`. Nama wilayah,
cabang, dan divisi lainnya tetap harus sama dengan penempatan Employee.
Tanda `&` diperlakukan sebagai `DAN`. `UNIT_MISMATCH` berarti nama Excel
merujuk satu unit DB yang berbeda dari unit Employee. Nama yang belum
dikenali masuk `REVIEW / UNIT_NAME_REQUIRES_REVIEW`; nama yang merujuk
beberapa unit masuk `REVIEW / UNIT_NAME_AMBIGUOUS`. Penempatan Employee
yang kosong/tidak valid ditandai `ERROR / EMPLOYEE_UNIT_UNAVAILABLE`.

PIC hanya memenuhi syarat pada Jenjang IV/V (kode sumber `5`/`6`),
`KODE_STATPEG=01`, `STAT_KEPEG=02`, dan masih hadir di sumber Employee.

Alias tambahan yang telah ditinjau:
- `SEKRETARIAT PERUSAHAAN` = `SEKRETARIS PERUSAHAAN`;
- `PMO` = `PROJECT MANAGEMENT OFFICE` (nama setelahnya tetap harus sesuai);
- `TANGGERANG` = `TANGERANG`;
- tepat `KANCAV LANGGUR` = `KANTOR CABANG LANGGUR`.

Hasil review berikut juga diterima sebagai pasangan nama unit yang sama.
Pencocokan pasangan memakai nama penuh setelah normalisasi spasi,
kapitalisasi, dan singkatan KANWIL/KANCAB; alias tidak diperluas ke unit lain.

| Nama pada Excel | Nama ekuivalen |
| --- | --- |
| UB JASTASMA | UB-JASTASMA |
| UB-SENTRA NIAGA | UB-BULOG SENTRA NIAGA |
| KANCAB BLANGPIDIE | KANTOR CABANG BLANG PIDIE |
| KANWIL JAKARTA DAN BANTEN | KANTOR WILAYAH DKI JAKARTA DAN BANTEN |
| KACAB BOGOR | KANTOR CABANG BOGOR |
| KANCAB PUTUSIBAU | KANTOR CABANG PUTUSSIBAU |
| KANCAB LUWUK | KANTOR CABANG LUWUK BANGGAI |
| KANCAB TOLITOLI | KANTOR CABANG TOLI-TOLI |
| KANCAB POLEWALI MANDAR | KANTOR CABANG POLMAN |
| KANWIL PAPUA DAN PABAR | KANTOR WILAYAH PAPUA |
| KANCAB FAK-FAK | KANTOR CABANG FAK FAK |
| KANCAB TEMBINABUAN | KANTOR CABANG TEMINABUAN |

Alias hanya dipakai untuk membandingkan nama. Master Unit tidak diubah,
dan akun baru tetap memakai `Employee.unitId` yang terverifikasi.

`DATABASE_URL` dibaca dari environment, kemudian `.env.local` dan `.env`.

## Pratinjau

```powershell
npm run import:pic -- --file ".\Daftar_PIC.xlsx"
```

Pratinjau hanya membaca database. Hasil dikelompokkan menjadi `CREATE`
(akun baru), `ALREADY_ASSIGNED` (PIC aktif yang sesuai), `REVIEW`
(perlu tinjauan Admin), dan `ERROR` (salah). Secara default, REVIEW atau ERROR
menolak seluruh file untuk penerapan. Akun existing tidak dipromosikan atau
diaktifkan otomatis.

Laporan disimpan ke `Daftar_PIC.xlsx.pic-preview.json`. Laporan existing
tidak ditimpa. Untuk pratinjau berikutnya, tentukan file laporan baru:

```powershell
npm run import:pic -- --file ".\Daftar_PIC.xlsx" --report ".\preview-pic-2.json"
```

## Terapkan setelah mendapat otorisasi database

Periksa seluruh hasil pratinjau, identitas database, SHA256 file, dan
fingerprint target yang dicetak. Gunakan ID User ADMIN SSO yang aktif.

```powershell
npm run import:pic -- --file ".\Daftar_PIC.xlsx" --apply --preview-report ".\Daftar_PIC.xlsx.pic-preview.json" --confirm-file "SHA256_DARI_PRATINJAU" --confirm-target "FINGERPRINT_DARI_PRATINJAU" --admin-user-id "ID_ADMIN_SSO_AKTIF"
```

Script memvalidasi ulang target dan data dalam satu transaksi serializable.
Perubahan setelah pratinjau menolak penerapan. Kegagalan membatalkan seluruh
transaksi. PIC aktif yang sesuai dilewati; PIC di luar file tetap seperti semula.
Untuk menjalankan ulang file yang sudah diterapkan, buat pratinjau baru dahulu.

## Terapkan sebagian, lewati ERROR dan REVIEW

Gunakan `--skip-invalid` pada **pratinjau dan penerapan**. Script hanya membuat
baris `CREATE`, melewati `ALREADY_ASSIGNED`, dan melaporkan seluruh baris
`ERROR`/`REVIEW` yang dilewati. Akun existing bermasalah tidak diubah.
Pratinjau tetap memuat semua baris, jumlah, alasan, serta mode yang dipilih.

```bash
npm run import:pic -- --file "./Template_PIC.xlsx" --skip-invalid --report "./preview-pic-8.json"
```

Setelah meninjau hasil dan memastikan target database:

```bash
npm run import:pic -- --file "./Template_PIC.xlsx" --skip-invalid --apply --preview-report "./preview-pic-8.json" --confirm-file "SHA256_DARI_PRATINJAU" --confirm-target "FINGERPRINT_DARI_PRATINJAU" --admin-user-id "ID_ADMIN_SSO_AKTIF"
```

Laporan lama versi 1 perlu dibuat ulang. Mode, file, target, dan semua baris
harus sama dengan pratinjau baru. Jika Employee atau akun berubah, termasuk
baris yang sebelumnya dilewati menjadi layak, penerapan ditolak dan perlu
pratinjau ulang. File rusak, format salah, rumus, dan NIP duplikat tetap
menolak seluruh file. Mode sebagian memerlukan setidaknya satu baris
`CREATE` atau `ALREADY_ASSIGNED`.

Semua pembuatan akun tetap dalam satu transaksi; kegagalan satu pembuatan
membatalkan seluruh pembuatan di batch tersebut. Jalankan pratinjau baru
untuk mengulang file; akun yang sudah dibuat menjadi `ALREADY_ASSIGNED`.

## Verifikasi

```powershell
node --experimental-test-module-mocks --import tsx --test src/lib/pic-import.test.ts src/lib/pic-import-target.test.ts src/lib/pic-import-apply.test.ts src/lib/employee-excel-import.test.ts src/lib/user-management.test.ts
npx tsc --noEmit
```

Test parser membaca salinan workbook lokal `Template_PIC.xlsx` di memori;
file Excel asli dan database tidak diubah oleh test.
