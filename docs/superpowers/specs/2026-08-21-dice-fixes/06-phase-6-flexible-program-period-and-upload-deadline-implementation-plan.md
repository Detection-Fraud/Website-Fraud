# Phase 6: Flexible Program Period and Upload Deadline Implementation Plan

**Tanggal:** 23 Agustus 2026

**Design spec:** `06-phase-6-flexible-program-period-and-upload-deadline-design.md`

**Catatan proses:** Skill `writing-plans` tidak tersedia pada instalasi lokal. Dokumen ini adalah fallback implementation plan manual berdasarkan design spec yang telah disetujui.

## Goal

Pisahkan periode kegiatan dari deadline upload tanpa mengubah laporan lama. TW menjadi label periode program. Analytics, compliance, dan halaman utama PIC harus memilih data melalui identitas program `year(startDate) + tw`, bukan rentang bulan kalender tetap.

## Prinsip Implementasi

- Pertahankan `startDate` dan `endDate` sebagai periode kegiatan.
- Tambahkan hanya satu field baru, `uploadDeadline`.
- Backend menjadi sumber kebenaran seluruh aturan tanggal.
- Gunakan helper periode bersama agar logika TW/tahun tidak tersebar.
- Gunakan query agregasi Prisma dan hindari N+1.
- Pertahankan endpoint yang ada jika dapat diperluas dengan aman.
- Gunakan Axios dan TanStack Query untuk API internal.
- Gunakan HeroUI v3 untuk modal dan selector.
- Jangan mengubah kolase, kalender, atau banner kecuali verifikasi menemukan kontrak yang rusak.

## Skill yang Digunakan Saat Implementasi

- `api-backend-guard` untuk route Program Budaya, submit, analytics, dan export.
- `axios-tanstack-query` untuk mutation Program Budaya dan query dashboard PIC.
- `prisma-safe-query` untuk conflict count, period lookup, aggregation, dan pagination.
- `zod` untuk schema tanggal dan cross-field validation.
- `heroui-react` untuk modal, date picker, select, button, dan confirmation modal.
- `ui-ux-pro-max` untuk aksesibilitas form, error feedback, responsive modal, dan selector periode.
- `design-taste-frontend` hanya untuk audit konsistensi visual existing UI.
- `performance` untuk memastikan dashboard hanya fetch satu periode dan tidak menjalankan query per program/unit.

## Task 1: Tambahkan Contract Check Periode

**Files:**

- Create: `scripts/check-program-period-contract.ts`
- Reference: `scripts/check-pic-collage-contract.ts`
- Modify: `package.json`

### Langkah

1. Buat script kontrak berbasis `tsx`, mengikuti pola script kontrak kolase yang sudah ada.
2. Tambahkan assertions untuk helper murni berikut:
   - Rentang valid pada satu tahun.
   - Rentang kegiatan lintas tahun ditolak.
   - Deadline tahun berikutnya diterima.
   - Deadline sebelum `endDate` ditolak.
   - Batas `startDate`, `endDate`, dan `uploadDeadline` bersifat inklusif.
   - Mapping `TW1`, `TW2`, `TW3`, `TW4`, `SM1`, `SM2`, dan `ALL` menghasilkan kumpulan label TW yang benar.
   - Default period memilih kegiatan yang sedang berjalan sebelum grace period.
3. Tambahkan script package:

```json
"check:program-period": "tsx scripts/check-program-period-contract.ts"
```

### Verifikasi

```powershell
npm run check:program-period
```

Script boleh gagal pada awal task karena helper belum dibuat. Setelah Task 3, seluruh assertion wajib lulus.

## Task 2: Tambahkan `uploadDeadline` dengan Migrasi Aman

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_program_upload_deadline/migration.sql`

### Perubahan schema

Tambahkan:

```prisma
uploadDeadline DateTime

@@index([tw, startDate])
@@index([isActive, uploadDeadline])
```

Pertahankan index lama sampai query baru diverifikasi. Jangan menghapus index dalam task ini.

### Strategi migrasi

Migration SQL harus melakukan urutan berikut dalam satu migration:

1. Tambahkan kolom nullable.
2. Backfill `uploadDeadline = endDate`.
3. Ubah kolom menjadi `NOT NULL`.
4. Buat index yang diperlukan.

Gunakan migration create-only agar SQL backfill dapat diperiksa sebelum dijalankan:

```powershell
npx prisma migrate dev --name add_program_upload_deadline --create-only
npx prisma format
npx prisma validate
```

Setelah SQL diperiksa dan backup database tersedia:

```powershell
npx prisma migrate dev
npx prisma generate
```

### Verifikasi data

Pastikan tidak ada program dengan deadline null dan seluruh program lama memiliki deadline sama dengan `endDate`.

## Task 3: Buat Helper Periode dan Schema Cross-field

**Files:**

- Create: `src/lib/api/program-period.ts`
- Modify: `src/schemas/program.schema.ts`
- Modify: `scripts/check-program-period-contract.ts`

### Tanggung jawab helper

`program-period.ts` hanya berisi logika periode yang dapat diuji tanpa React:

- Konversi input tanggal bisnis ke batas hari Asia/Jakarta.
- Mendapatkan tahun program dari `startDate`.
- Validasi urutan tiga tanggal.
- Menentukan apakah program sedang menerima upload.
- Mapping filter periode ke daftar TW.
- Membentuk batas awal dan akhir tahun program.
- Memilih default dari daftar periode terbuka.

Gunakan nama eksplisit, misalnya:

```text
getProgramYear
validateProgramDates
isUploadOpen
getTwValuesForPeriod
getProgramYearBounds
selectDefaultOpenPeriod
```

Jangan menaruh query Prisma di helper murni ini.

### Schema Zod

Tambahkan `uploadDeadline` pada `createProgramSchema`, lalu gunakan `superRefine` untuk:

- `endDate >= startDate`.
- Tahun `startDate` sama dengan tahun `endDate`.
- `uploadDeadline >= endDate`.

Error harus diarahkan ke field yang tepat, terutama `endDate` dan `uploadDeadline`.

### Verifikasi

```powershell
npm run check:program-period
npx tsc --noEmit
```

## Task 4: Perbarui API Create dan Edit Program

**Files:**

- Modify: `src/app/api/programs/route.ts`
- Modify: `src/app/api/programs/[id]/route.ts`

### POST

1. Ambil `uploadDeadline` dari hasil parse Zod.
2. Pertahankan authorization Admin dan validasi kategori.
3. Simpan tiga tanggal dari hasil schema, bukan body mentah.
4. Kembalikan response envelope yang sama agar hook existing tidak rusak.

### PUT

1. Parse payload lengkap dengan schema yang sama.
2. Ambil program existing dan count laporan konflik secara paralel jika aman.
3. Gunakan `prisma.activityReport.count`, bukan `findMany().length`.
4. Konflik adalah laporan program yang memenuhi salah satu:

```text
tanggalKegiatan < startDate baru
tanggalKegiatan > endDate baru
```

5. Jika count lebih dari nol, return HTTP 409 dengan jumlah konflik.
6. Jika valid, update program secara atomik.
7. Jangan delete atau update `ActivityReport`.

Perubahan TW atau tahun program tetap diperbolehkan. Seluruh laporan ikut diklasifikasikan melalui relasi `programId` dan UI akan meminta konfirmasi.

### Verifikasi

- POST valid menghasilkan program dengan deadline.
- PUT rentang valid berhasil.
- PUT rentang konflik menghasilkan 409.
- PUT deadline masa lalu berhasil jika `deadline >= endDate`.
- Request non-Admin tetap ditolak.

## Task 5: Ubah Mutation dan Modal Program Budaya

**Files:**

- Modify: `src/hooks/useProgramMutation.ts`
- Modify: `src/app/(main)/admin/programs/_components/ModalForm.tsx`
- Reuse or modify: `src/app/(main)/admin/management/_components/ModalConfirmAction.tsx`

### Mutation

1. Tambahkan `uploadDeadline` ke `ProgramPayload`.
2. Baca `uploadDeadline` dari `FormData`.
3. Pertahankan Axios dan TanStack Query mutation.
4. Setelah sukses, invalidasi:
   - `programs`
   - `program-list`
   - `categories`
   - `program-categories`
   - `program-periods`
   - `pic-dashboard`
5. Jangan menginvalidasi query yang tidak bergantung pada Program Budaya.

### Modal HeroUI v3

1. Hapus `TW_DATE_RANGES`, `computeTwDates`, dan hidden date hasil auto-compute.
2. Pertahankan pilihan TW, tetapi hapus label bulan seperti `Jan-Mar`.
3. Tambahkan state `CalendarDate` untuk:
   - Tanggal mulai kegiatan.
   - Tanggal selesai kegiatan.
   - Deadline upload.
4. Gunakan HeroUI v3 `DatePicker` atau `DateField` sesuai dokumentasi resmi yang telah diperiksa.
5. Parse edit value sebagai tanggal tanpa timezone menggunakan `@internationalized/date`.
6. Render input hidden ISO/date-only hanya jika mutation existing masih membutuhkan `FormData`.
7. Tampilkan ringkasan periode dengan format Indonesia yang tidak ambigu.
8. Tampilkan info netral ketika deadline berada pada tahun berikutnya.
9. Tampilkan inline error untuk urutan tanggal dan lintas tahun.
10. Gunakan `Modal.Header`, body scroll internal, dan `Modal.Footer` sticky bila konten melebihi viewport.
11. Gunakan pending state pada tombol Simpan dan cegah submit ganda.
12. Pada deadline baru yang sudah lewat, tampilkan confirmation modal.
13. Pada perubahan TW atau tahun program yang sudah memiliki laporan, tampilkan confirmation modal jika API/list menyediakan report count. Jika count belum tersedia, konfirmasi tetap dipicu saat nilai identitas berubah dari initial value.

### Design constraints

- Existing visual language dipertahankan.
- Tidak ada dependency baru.
- Label selalu terlihat.
- Error tidak bergantung pada warna.
- Target interaksi minimal 44px.
- Mobile satu kolom.
- Light dan dark mode tetap terbaca.

### Verifikasi

- Create dan edit mempertahankan value tiga tanggal.
- Tidak ada lagi tanggal otomatis saat TW berubah.
- Keyboard dapat mencapai seluruh field dan action.
- Deadline tahun berikutnya tidak tampil sebagai error.
- Konfirmasi tampil hanya untuk perubahan berisiko.

## Task 6: Tegakkan Jendela Upload pada Submit

**Files:**

- Modify: `src/app/api/reports/route.ts`
- Modify: `src/hooks/useFormDetectionLogic.ts`
- Modify: `src/app/(main)/pic/submit/_components/form-detection.tsx`
- Review: route edit laporan yang mengubah `tanggalKegiatan`

### Backend

Setelah mengambil program:

1. Tolak program nonaktif.
2. Tolak upload jika hari ini sebelum `startDate`.
3. Tolak upload jika hari ini setelah `uploadDeadline`.
4. Pertahankan validasi `tanggalKegiatan` terhadap `startDate` sampai `endDate`.
5. Gunakan helper tanggal bersama agar batas hari konsisten.
6. Jangan menggunakan `endDate` sebagai deadline upload lagi.

### Frontend

1. Program baru dapat dipilih jika aktif dan `startDate <= today <= uploadDeadline`.
2. Saat edit laporan existing, program existing tetap dapat ditampilkan agar form tidak kehilangan konteks.
3. Date picker kegiatan tetap memakai `startDate` dan `endDate`, bukan deadline.
4. Label option program menampilkan nama, TW, tahun program, dan deadline secara ringkas.
5. Empty state menjelaskan bahwa tidak ada program dengan jendela upload terbuka.

### Verifikasi

- Upload grace period berhasil dengan tanggal kegiatan lama yang valid.
- Upload setelah deadline ditolak backend walau frontend dimanipulasi.
- Program belum dimulai tidak tersedia.
- `tanggalKegiatan` pada grace period tetap tidak boleh melewati `endDate`.

## Task 7: Buat Resolver Program untuk Analytics

**Files:**

- Create: `src/lib/api/analytics/resolve-program-period.ts`
- Modify: `src/lib/api/analytics/types.ts`
- Modify: `src/lib/api/constants.ts`
- Modify: `scripts/check-program-period-contract.ts`

### API resolver

Buat resolver yang menerima:

```text
year
periode: TW1 | TW2 | TW3 | TW4 | SM1 | SM2 | ALL
optional programId
```

Resolver melakukan satu query `programBudaya.findMany` dengan select minimal dan menghasilkan:

```text
programIds
programs untuk perhitungan target
twValues
year
```

Filter tahun menggunakan batas `startDate` dari 1 Januari sampai 31 Desember pada tahun terpilih. Filter TW menggunakan daftar label TW. Jika `programId` diberikan, pastikan program tersebut termasuk periode/tahun yang diminta.

Program legacy dengan `tw = null` tidak dimasukkan ke selector atau analytics berbasis TW. Sebelum rollout, hitung record tersebut dan perbaiki melalui data correction yang eksplisit. Jangan menebak TW dari bulan `startDate` karena TW sudah ditetapkan sebagai label bisnis.

### Integrasi query

Consumer menerima `whereClause` yang sudah berisi:

```text
programId: { in: programIds }
```

Dengan begitu helper analytics tidak perlu membuat ulang relasi program dan tidak perlu mengetahui bulan TW.

`getMonthRange()` boleh dipertahankan hanya jika masih dipakai fitur non-Program Budaya. Hapus penggunaan fungsi tersebut dari alur Program Budaya.

### Empty set

Jika tidak ada program pada periode, short-circuit ke response statistik kosong. Jangan menjalankan agregasi dengan filter program kosong yang berpotensi menghasilkan data seluruh tahun.

## Task 8: Migrasikan Consumer Admin Analytics

**Files:**

- Modify: `src/app/api/analytics/dashboard/route.ts`
- Modify: `src/lib/api/analytics/get-summary-cards.ts`
- Modify: `src/lib/api/analytics/get-distribusi.ts`
- Modify: `src/lib/api/analytics/get-ranking.ts`
- Modify: `src/lib/api/analytics/get-ranking-cc.ts`
- Modify: `src/lib/api/analytics/get-top-units.ts`
- Review/modify: `src/lib/api/analytics/get-monthly-trend.ts`

### Route dashboard

1. Resolve scope unit seperti sekarang.
2. Resolve program period satu kali.
3. Gabungkan `programId` hasil resolver dengan scope unit.
4. Jalankan helper agregasi secara paralel.

### Helper agregasi

1. Hapus parameter `startMonth` dan `endMonth` dari helper yang tidak lagi memerlukannya.
2. Hapus pembuatan `tanggalKegiatan` range berbasis bulan TW.
3. Pertahankan filter unit, program spesifik, status, dan pagination.
4. Ranking CC menghitung target dari program hasil resolver, termasuk program periode yang deadline-nya lewat dan program historis yang kini nonaktif.
5. Monthly trend tetap mengelompokkan `tanggalKegiatan` per bulan dalam tahun program.
6. Semua count tetap dilakukan di database.

### Regression checks

- Filter `unitType`, Kanwil, Kancab, dan Divisi tetap bekerja.
- Program spesifik tidak keluar dari tahun/TW terpilih.
- Pagination ranking tetap global.
- TW dengan rentang kegiatan nonstandar tetap masuk berdasarkan program.

## Task 9: Perbarui API Dashboard PIC dengan Selector Periode

**Files:**

- Modify: `src/app/api/pic/dashboard/route.ts`

### Endpoint

Perluas endpoint existing:

```text
GET /api/pic/dashboard?year=2026&tw=4
```

Jangan membuat endpoint periode terpisah kecuali response menjadi tidak dapat dipertahankan.

### Query daftar periode terbuka

Ambil program dengan select minimal yang memenuhi:

```text
isActive = true
startDate <= today
uploadDeadline >= today
```

Kelompokkan berdasarkan `year(startDate) + tw`, lalu pilih default deterministik sesuai design spec.

### Statistik periode

Setelah periode dipilih:

1. Ambil seluruh program dengan tahun/TW tersebut tanpa filter `isActive` dan tanpa filter deadline.
2. Hitung target dari seluruh program periode.
3. Hitung status report PIC untuk `programId` dalam periode.
4. Hitung leaderboard memakai program IDs yang sama.
5. Recent activities tetap global karena bukan bagian filter periode.
6. Banner/program list memakai seluruh program periode terpilih.

### Response

Ganti ketergantungan pada `currentTw` dengan contract eksplisit:

```text
periods
selectedPeriod: { year, tw, label }
stats
rank
leaderboard
periodPrograms
recentActivities
```

Jika tidak ada periode terbuka, return array kosong dan statistik nol dengan status 200.

### Performance

- Gunakan select minimal untuk period list.
- Gunakan `groupBy` untuk status dan leaderboard.
- Jangan query setiap program atau setiap PIC.
- Jalankan agregasi independen dengan `Promise.all`.

## Task 10: Tambahkan Selector pada `/pic/halaman-utama`

**Files:**

- Modify: `src/hooks/usePicDashboard.ts`
- Modify: `src/app/(main)/pic/halaman-utama/_components/BerandaPicView.tsx`
- Review: `src/app/(main)/pic/halaman-utama/_components/BannerCarousel.tsx`

### Hook

Ubah signature menjadi menerima optional period:

```text
usePicDashboard({ year, tw })
```

Query key wajib menyertakan periode:

```text
["pic-dashboard", year, tw]
```

Gunakan Axios wrapper existing. Pertahankan stale time dua menit kecuali pengujian menunjukkan data approval perlu lebih cepat.

### View HeroUI v3

1. Simpan period selection sebagai state lokal pada view.
2. Render HeroUI `Select` di header halaman utama.
3. Gunakan label seperti `TW IV 2026`.
4. Saat initial response memberi default period, sinkronkan state satu kali tanpa loop fetch.
5. Selector mengubah stats, compliance, leaderboard, dan banner program.
6. Recent activities tidak berubah ketika selector berpindah.
7. Tampilkan skeleton stabil saat refetch tanpa menghilangkan seluruh layout jika data lama masih tersedia.
8. Tampilkan empty state jika tidak ada periode upload terbuka.
9. Selector dapat digunakan dengan keyboard dan mempunyai visible label.

### Verifikasi

- TW 4 2026 dan TW 1 2027 muncul bersamaan.
- TW kegiatan berjalan menjadi default.
- Pergantian selector hanya memicu satu request periode baru.
- Tidak ada render loop saat default period diterima.
- Seluruh statistik menggunakan periode yang sama.

## Task 11: Samakan Compliance Report dan Export

**Files:**

- Modify: `src/app/api/reports/compliance/route.ts`
- Modify: `src/app/api/reports/compliance/export/route.ts`
- Review: hooks dan filter compliance yang mengirim `year` atau program/category.

### Perubahan

1. Resolve daftar program berdasarkan tahun `startDate`, bukan hanya `tanggalKegiatan` pada tahun kalender.
2. Batasi submission dengan `programId` hasil resolver/category selection.
3. Pertahankan monthly sheet berdasarkan bulan `tanggalKegiatan`.
4. Pastikan target menggunakan program periode yang sama dengan submission.
5. Program expired atau nonaktif tetap masuk histori dan target periode.
6. Gunakan agregasi/database query yang sudah ada. Jangan memuat semua laporan hanya untuk menghitung total.

### Verifikasi

- Tampilan compliance dan file export menghasilkan total yang sama.
- Laporan TW 4 yang di-upload Januari tetap masuk TW 4 karena `programId` dan tanggal kegiatan.
- Scope unit dan category filter tetap identik antara layar dan export.

## Task 12: Verifikasi Consumer yang Seharusnya Tidak Berubah

**Files:**

- Review: `src/app/api/reports/collage/options/route.ts`
- Review: `src/lib/api/collage.ts`
- Review: `src/app/api/kalender/programs/route.ts`
- Review: `src/components/kalendar/CalendarGrid.tsx`
- Review: `src/app/(main)/pic/halaman-utama/_components/BannerCarousel.tsx`
- Review: `src/app/(main)/admin/programs/_components/cards/ProgramCardItem.tsx`

### Contract checks

- Kolase tetap menampilkan periode dari `startDate/endDate`.
- Kalender tetap menggambar rentang kegiatan, bukan deadline upload.
- Banner tetap menampilkan periode kegiatan.
- Program card menampilkan periode kegiatan dan sebaiknya menambahkan teks deadline upload jika ruang tersedia.
- Tidak ada consumer yang menganggap `endDate` sebagai batas upload selain submit.

Jangan refactor file ini jika contract tetap benar.

## Task 13: Final Verification dan Dokumentasi Roadmap

**Files:**

- Modify: `docs/superpowers/specs/2026-08-21-dice-fixes/00-overview.md`
- Modify if needed: design spec Phase 6 hanya jika implementasi menemukan keputusan yang benar-benar berubah

### Command verifikasi

```powershell
npm run check:program-period
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

Jika lint seluruh repository gagal karena masalah existing, jalankan ESLint pada file yang diubah dan dokumentasikan kegagalan baseline secara terpisah.

### Manual verification

1. Buat DONITA TW 4 2026 dengan kegiatan Oktober-Desember dan deadline Februari 2027.
2. Pastikan program tersedia untuk submit pada Januari 2027.
3. Pastikan tanggal kegiatan Januari 2027 ditolak.
4. Buat TW 1 2027 dan pastikan kedua periode muncul pada halaman utama.
5. Pindahkan selector dan cocokkan stats, target, dan leaderboard.
6. Persingkat deadline ke tanggal yang sudah lewat dan pastikan confirmation muncul.
7. Pastikan laporan lama tetap ada.
8. Coba mempersempit periode melewati tanggal laporan lama dan pastikan API mengembalikan 409.
9. Bandingkan compliance layar dengan export.
10. Verifikasi kolase, kalender, dan banner tidak berubah perilakunya.

### Update roadmap

Tandai Phase 6 selesai hanya setelah migration, backend guard, dashboard selector, analytics, compliance/export, dan seluruh verifikasi utama lulus.

## Urutan Commit yang Disarankan

1. `test: add program period contract checks`
2. `feat: add program upload deadline`
3. `feat: validate flexible program periods`
4. `feat: update program period form`
5. `fix: enforce program upload window`
6. `refactor: resolve analytics by program period`
7. `feat: add PIC period selector`
8. `fix: align compliance with program periods`
9. `docs: mark flexible program period complete`

Setiap commit harus tetap dapat di-typecheck setelah Prisma client digenerate. Jangan mencampur perubahan unrelated dari worktree saat ini.

## Definition of Done

- Migration lama dan baru dapat berjalan tanpa kehilangan data.
- Semua program mempunyai `uploadDeadline`.
- Admin memilih TW dan tiga tanggal secara manual.
- Backend menolak urutan tanggal invalid dan konflik laporan lama.
- PIC dapat upload pada grace period tanpa mengubah tanggal kegiatan.
- Halaman utama PIC mendukung overlap TW lama dan baru.
- Analytics memakai program year/TW, bukan bulan kalender tetap.
- Compliance screen dan export konsisten.
- Tidak ada N+1 atau `findMany().length` baru.
- Kolase, kalender, banner, pagination, authorization, dan scope unit tidak regresi.
- Contract check, Prisma validate, TypeScript, lint, dan build lulus atau memiliki baseline failure yang terdokumentasi.
