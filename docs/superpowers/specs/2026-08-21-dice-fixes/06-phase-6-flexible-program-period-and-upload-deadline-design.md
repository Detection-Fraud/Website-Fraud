# Phase 6: Flexible Program Period and Upload Deadline Design

**Tanggal desain:** 23 Agustus 2026

**Status:** Disetujui dalam sesi brainstorming, menunggu review dokumen

**Pendekatan:** Pertahankan `startDate` dan `endDate`, lalu tambahkan satu field `uploadDeadline`

## 1. Tujuan

Admin harus dapat menentukan label triwulan, rentang kegiatan, dan batas upload secara independen. Perpanjangan waktu upload tidak boleh memperluas rentang tanggal kegiatan atau mengubah identitas periode analytics.

Contoh kebutuhan:

- Program: DONITA TW 4 2026
- Rentang kegiatan: 1 Oktober 2026 sampai 31 Desember 2026
- Upload dibuka: 1 Oktober 2026
- Deadline upload: 28 Februari 2027

PIC boleh mengirim laporan sampai 28 Februari 2027, tetapi `tanggalKegiatan` tetap harus berada pada 1 Oktober sampai 31 Desember 2026.

## 2. Keputusan Utama

1. `tw` adalah label pengelompokan, bukan sumber rentang tanggal otomatis.
2. Admin mengisi `startDate`, `endDate`, dan `uploadDeadline` secara manual.
3. `startDate` dan `endDate` adalah periode kegiatan.
4. Upload dibuka pada `startDate` dan ditutup setelah `uploadDeadline`.
5. Rentang kegiatan wajib berada dalam satu tahun kalender.
6. `uploadDeadline` boleh berada pada tahun berikutnya.
7. Tahun program ditentukan dari tahun `startDate`.
8. Analytics memfilter laporan melalui identitas program, yaitu tahun program dan TW, bukan melalui pemetaan TW ke bulan kalender tetap.
9. Program lama dimigrasikan dengan `uploadDeadline = endDate`.
10. Tidak ada laporan yang dihapus atau diubah oleh fitur ini.

## 3. Batas Scope

### Termasuk

- Model dan migrasi `ProgramBudaya`.
- Form create/edit Program Budaya.
- Validasi create/edit pada backend.
- Validasi waktu upload dan tanggal kegiatan.
- Selector periode pada `/pic/halaman-utama`.
- Statistik, target, compliance, dan ranking berbasis periode program.
- Penyesuaian filter analytics yang masih menganggap TW sebagai kuartal kalender tetap.
- Backfill data Program Budaya lama.
- Pengujian aturan periode dan deadline.

### Tidak termasuk

- Menghapus atau memindahkan laporan lama.
- Model periode terpisah.
- Banyak riwayat perpanjangan deadline.
- Tanggal buka upload yang terpisah dari `startDate`.
- Perubahan format import partisipasi.
- Perubahan ranking tie-breaker berdasarkan waktu approval.
- Redesign menyeluruh halaman admin atau PIC.

## 4. Model Data

`ProgramBudaya` mempertahankan field yang ada dan menambah satu field wajib:

```prisma
model ProgramBudaya {
  // field yang sudah ada
  tw             Int?
  startDate      DateTime
  endDate        DateTime

  // field baru
  uploadDeadline DateTime
}
```

Makna field:

| Field | Makna |
| --- | --- |
| `tw` | Label TW 1 sampai 4 |
| `startDate` | Hari pertama kegiatan dan hari pertama upload |
| `endDate` | Hari terakhir tanggal kegiatan yang sah |
| `uploadDeadline` | Hari terakhir PIC boleh mengirim laporan |

Field tanggal diperlakukan sebagai tanggal bisnis, bukan waktu presisi yang dipilih Admin. Perbandingan hari menggunakan zona waktu Asia/Jakarta dan bersifat inklusif.

## 5. Invariant dan Validasi

Backend wajib menegakkan seluruh aturan berikut:

```text
tw berada pada 1 sampai 4
startDate <= endDate
endDate <= uploadDeadline
year(startDate) = year(endDate)
```

Aturan submit laporan:

```text
program.isActive = true
hari ini >= startDate
hari ini <= uploadDeadline
tanggalKegiatan >= startDate
tanggalKegiatan <= endDate
```

Semua batas tanggal inklusif. Validasi frontend hanya memberikan feedback cepat. Backend tetap menjadi sumber kebenaran.

## 6. Perilaku Edit

Admin boleh:

- Mengubah TW.
- Mengubah rentang kegiatan.
- Memperpanjang deadline upload.
- Memperpendek deadline upload.
- Mengatur deadline ke tanggal yang sudah lewat selama deadline tersebut tidak lebih awal dari `endDate`.

Jika deadline baru sudah lewat, program langsung tertutup untuk upload baru. Laporan yang sudah tersimpan tidak berubah.

Sebelum memperbarui `startDate` atau `endDate`, backend menghitung laporan program yang `tanggalKegiatan`-nya berada di luar rentang baru. Jika ada, update ditolak dengan HTTP 409. Periode lama dan seluruh laporan tetap dipertahankan.

Contoh pesan:

> Periode tidak dapat diubah karena 3 laporan memiliki tanggal kegiatan di luar rentang baru.

Perubahan `tw` atau tahun `startDate` pada program yang sudah memiliki laporan diperbolehkan setelah validasi konflik tanggal berhasil. Karena laporan terhubung melalui `programId`, seluruh laporan program tersebut ikut diklasifikasikan ke identitas periode baru tanpa mengubah isi laporan. UI wajib meminta konfirmasi karena perubahan ini memengaruhi analytics historis. Update tetap atomik dan tidak ada update parsial.

## 7. Form Admin Program Budaya

### Design read

Targeted evolution untuk modal admin operasional. Visual harus ringkas, trust-first, konsisten dengan aplikasi saat ini, dan tetap menggunakan HeroUI v3 sebagai satu-satunya component system.

`design-taste-frontend` hanya digunakan sebagai audit konsistensi visual karena skill tersebut bukan pedoman utama untuk admin form. Struktur interaksi mengikuti HeroUI v3 dan pedoman form `ui-ux-pro-max`.

### Struktur modal

Bagian identitas program tetap mempertahankan:

- Nama program.
- Kategori induk.
- Target frekuensi.
- Deskripsi.
- Banner.

Bagian jadwal berisi:

1. Pilihan `TW I`, `TW II`, `TW III`, dan `TW IV`.
2. Date picker `Tanggal Mulai Kegiatan`.
3. Date picker `Tanggal Selesai Kegiatan`.
4. Date picker `Deadline Upload`.
5. Ringkasan periode setelah semua tanggal lengkap.

Label bulan seperti `Jan-Mar` di dalam pilihan TW dihapus karena dapat menyiratkan tanggal otomatis.

Layout desktop menampilkan tanggal mulai dan selesai dalam dua kolom. Deadline upload menggunakan lebar penuh. Pada layar kecil, ketiga input tanggal ditumpuk satu kolom dan modal memakai scroll internal.

Contoh ringkasan:

```text
Kegiatan: 1 Oktober 2026 - 31 Desember 2026
Upload dibuka: 1 Oktober 2026
Deadline: 28 Februari 2027
```

Jika deadline berada pada tahun berikutnya, UI menampilkan informasi netral bahwa masa upload diperpanjang. Kondisi ini bukan error.

### Ketentuan HeroUI dan aksesibilitas

- Gunakan pola compound component HeroUI v3.
- Gunakan `Modal.Header`, `Modal.Body`, dan `Modal.Footer` sesuai dokumentasi v3.
- Gunakan HeroUI `DatePicker` atau `DateField` berbasis `CalendarDate` agar input tidak bergantung pada timezone browser.
- Setiap input memiliki label yang selalu terlihat.
- Error berada di bawah field terkait dan diumumkan melalui mekanisme aksesibel.
- Status invalid tidak disampaikan melalui warna saja.
- Tombol memakai semantic variant dan target interaksi minimal 44px.
- Tombol Simpan memiliki pending state dan dinonaktifkan jika input wajib belum lengkap.
- Fokus berpindah ke field invalid pertama setelah validasi gagal.
- Tidak ada animasi dekoratif atau dependency UI baru.
- Form tetap mendukung light mode, dark mode, keyboard, dan layar kecil.

Jika Admin mempersingkat deadline ke tanggal yang sudah lewat, modal meminta konfirmasi sebelum mutation dikirim.

## 8. Identitas Periode

Identitas periode ditentukan oleh:

```text
programYear = year(program.startDate)
periodKey = programYear + tw
```

Contoh key konseptual:

```text
2026-TW4
2027-TW1
```

Tidak diperlukan kolom `year` baru. Rentang kegiatan yang wajib berada dalam satu tahun membuat tahun `startDate` cukup sebagai identitas tahun program.

Semester tetap dapat dipetakan sebagai kumpulan label TW:

- Semester 1: TW 1 dan TW 2 pada tahun program terpilih.
- Semester 2: TW 3 dan TW 4 pada tahun program terpilih.
- Semua: TW 1 sampai TW 4 pada tahun program terpilih.

Pemetaan ini hanya memilih program. Ia tidak membuat rentang bulan untuk `tanggalKegiatan`.

## 9. Resolver Periode Bersama

Satu helper backend menjadi sumber filter periode untuk analytics. Bentuk konseptualnya:

```text
resolveProgramPeriodFilter(year, periode, optionalProgramId)
```

Hasilnya adalah filter relasi program berdasarkan:

- `program.tw` atau kumpulan TW.
- Tahun `program.startDate`.
- `programId` jika satu program dipilih.

Helper ini menggantikan penggunaan `getMonthRange()` untuk filter TW, semester, dan tahun pada data yang berbasis Program Budaya.

Monthly trend tetap mengelompokkan hasil berdasarkan bulan `tanggalKegiatan`. Dengan demikian grafik menampilkan kapan kegiatan benar-benar dilakukan, setelah daftar laporan lebih dahulu dibatasi melalui identitas program.

Partisipasi tetap memakai identitas `tw + year` miliknya sendiri dan tidak diubah oleh resolver Program Budaya.

## 10. Selector Periode pada Halaman Utama PIC

Selector ditempatkan pada `/pic/halaman-utama`, dekat ringkasan periode. Selector bukan filter table laporan.

Sebuah periode muncul jika minimal satu program di dalam periode tersebut memenuhi:

```text
isActive = true
startDate <= hari ini
uploadDeadline >= hari ini
```

Periode dikelompokkan berdasarkan `year(startDate) + tw`, sehingga TW 4 2026 dan TW 1 2027 dapat tampil bersamaan.

Urutan default:

1. Utamakan periode yang rentang kegiatannya sedang berjalan.
2. Jika lebih dari satu, pilih yang `startDate`-nya paling baru.
3. Jika tidak ada kegiatan berjalan, pilih periode upload terbuka dengan `startDate` paling baru.

Jika tidak ada periode terbuka, halaman menampilkan empty state dan tidak membuat TW kalender palsu.

Selector memengaruhi:

- Card target, approved, pending, dan rejected.
- Persentase compliance.
- Ranking atau leaderboard.
- Daftar program yang dipantau.

Selector tidak memengaruhi histori table laporan di halaman lain.

## 11. Perbedaan Program Terbuka dan Statistik Periode

Ketersediaan selector dan isi statistik memiliki aturan berbeda:

- Selector periode muncul jika minimal satu program masih menerima upload.
- Statistik periode menghitung seluruh program yang pernah berjalan pada `year + tw` tersebut.
- Program dengan deadline yang sudah lewat tetap dihitung dalam target dan histori periode.
- Program yang kemudian dinonaktifkan tetap muncul dalam analytics historis.
- Form submit hanya menampilkan program individual yang saat ini aktif dan masih berada antara `startDate` sampai `uploadDeadline`.

Contoh TW 4 2026:

| Program | Deadline | Masuk statistik TW 4 | Bisa dipilih untuk submit |
| --- | --- | --- | --- |
| DONITA | 31 Desember 2026 | Ya | Tidak setelah deadline |
| AKHLAK | 31 Januari 2027 | Ya | Sesuai tanggal saat ini |
| Kolaborasi | 28 Februari 2027 | Ya | Sesuai tanggal saat ini |

Selama minimal satu program masih terbuka, TW 4 2026 tersedia pada selector. Statistik selalu menghitung ketiga program.

## 12. Dampak Analytics

Consumer yang sudah memakai tanggal program dan secara konsep tetap aman:

- Validasi `tanggalKegiatan`.
- Kalender program.
- Banner PIC.
- Kolase PIC.
- Card Program Budaya.

Consumer yang harus berhenti membuat rentang bulan tetap dari TW:

- Summary analytics.
- Distribusi program.
- Ranking unit.
- Ranking CC.
- Top unit.
- Dashboard dan leaderboard PIC.
- Compliance report dan export yang memakai periode.
- Helper `getMonthRange()` pada alur Program Budaya.

Filter kategori, unit kerja, dan scope otorisasi tetap digabungkan dengan filter periode program. Perubahan periode tidak boleh memperluas scope unit milik pengguna.

## 13. Alur Data

### Create atau edit program

1. Admin mengisi TW dan tiga tanggal.
2. Frontend melakukan validasi UX dasar.
3. Mutation mengirim `tw`, `startDate`, `endDate`, dan `uploadDeadline`.
4. Schema backend melakukan validasi cross-field.
5. Pada edit, backend memeriksa konflik dengan laporan lama.
6. Jika valid, program disimpan secara atomik.
7. Cache query program, selector periode, dan dashboard yang relevan diinvalidasi.

### Submit laporan

1. Frontend menampilkan program yang masih terbuka.
2. PIC memilih program dan tanggal kegiatan.
3. Backend mengambil program langsung dari database.
4. Backend memvalidasi status aktif, jendela upload, dan tanggal kegiatan.
5. Laporan hanya dibuat jika seluruh aturan lolos.

### Halaman utama PIC

1. Client meminta daftar periode upload yang masih terbuka.
2. Client memilih default deterministik atau pilihan pengguna.
3. Statistik diminta hanya untuk satu `year + tw` aktif.
4. Backend menerapkan scope unit dan resolver periode program.
5. Query agregasi menghasilkan card, compliance, ranking, dan daftar program.

## 14. Error Handling

| Kondisi | HTTP | Perilaku |
| --- | --- | --- |
| Input atau urutan tanggal tidak valid | 400 | Tampilkan error pada field terkait |
| Periode baru mengecualikan laporan lama | 409 | Batalkan update dan tampilkan jumlah konflik |
| Program tidak ditemukan | 404 | Tampilkan pesan program tidak tersedia |
| Program nonaktif atau upload belum dibuka | 400 | Tolak submit |
| Deadline sudah lewat | 400 | Tolak submit tanpa mengubah draft lokal |
| Tanggal kegiatan di luar rentang | 400 | Tolak submit dan tandai field tanggal kegiatan |
| Error server | 500 | Pesan umum, log detail hanya pada server |

Tidak ada operasi delete dalam alur perubahan periode.

## 15. Migrasi dan Kompatibilitas

Migrasi dilakukan bertahap agar aman untuk data lama:

1. Tambahkan `uploadDeadline` sebagai nullable.
2. Backfill seluruh program dengan `uploadDeadline = endDate`.
3. Verifikasi tidak ada nilai null.
4. Ubah `uploadDeadline` menjadi required.
5. Tambahkan index untuk pencarian periode terbuka dan filter periode analytics.

Index harus fokus pada query nyata, terutama kombinasi `tw` dengan `startDate`, serta `isActive` dengan `uploadDeadline`. Hindari menambah index untuk setiap kombinasi field.

## 16. Performance

- Query analytics tetap menggunakan `count`, `groupBy`, dan agregasi Prisma.
- Jangan menggunakan `findMany().length` untuk counting.
- Jangan melakukan query per program atau per unit.
- Ambil statistik hanya untuk periode selector yang aktif.
- Daftar periode terbuka diambil dengan select minimal, lalu dikelompokkan dari hasil kecil.
- Resolver menghasilkan `Prisma.ActivityReportWhereInput` yang dapat digunakan bersama scope unit.
- Data program pada statistik dipilih dengan field minimal.
- Query period selector dan dashboard diberi query key yang menyertakan `year` dan `tw`.
- Mutation program menginvalidasi hanya query program, periode terbuka, dan dashboard terkait.

## 17. Pengujian

### Schema dan API program

- Menerima tiga tanggal dengan urutan valid.
- Menolak TW di luar 1 sampai 4.
- Menolak `endDate < startDate`.
- Menolak rentang kegiatan lintas tahun.
- Menolak `uploadDeadline < endDate`.
- Menerima deadline pada tahun berikutnya.
- Membolehkan deadline yang sudah lewat pada edit.
- Menolak edit periode yang mengecualikan laporan lama.
- Memastikan update gagal tidak mengubah program atau laporan.

### Submit laporan

- Menerima upload tepat pada `startDate`.
- Menerima upload tepat pada `uploadDeadline`.
- Menolak upload sebelum `startDate`.
- Menolak upload setelah `uploadDeadline`.
- Menerima upload pada masa perpanjangan dengan tanggal kegiatan yang sah.
- Menolak tanggal kegiatan sebelum `startDate` atau setelah `endDate`.
- Menolak program nonaktif walaupun deadline belum lewat.

### Selector dan dashboard PIC

- Menampilkan dua periode yang overlap.
- Memilih periode kegiatan berjalan sebagai default.
- Menampilkan periode lama selama minimal satu program masih terbuka.
- Tidak menampilkan periode jika seluruh deadline telah lewat.
- Menampilkan empty state jika tidak ada periode terbuka.
- Hanya meminta statistik untuk periode yang dipilih.

### Analytics

- TW memfilter berdasarkan relasi program, bukan bulan kalender.
- Semester memfilter berdasarkan kumpulan TW pada tahun program.
- Program dengan deadline lewat tetap dihitung pada statistik periode.
- Program nonaktif tetap dihitung pada histori.
- Laporan yang di-upload pada tahun berikutnya tetap masuk TW berdasarkan program dan `tanggalKegiatan`, bukan `createdAt`.
- Monthly trend menempatkan laporan pada bulan `tanggalKegiatan` sebenarnya.
- Scope unit dan role tidak berubah setelah filter periode ditambahkan.

### UI dan aksesibilitas

- Navigasi keyboard bekerja pada modal, pilihan TW, date picker, dan tombol.
- Fokus tetap terperangkap di modal dan kembali ke trigger saat ditutup.
- Error diumumkan dan tidak bergantung pada warna.
- Pending state mencegah submit ganda.
- Layout tidak overflow pada mobile.
- Light mode dan dark mode memiliki kontras yang cukup.

## 18. Blast Radius Hasil Review Graph

`code-review-graph` diperbarui pada branch `testing` dan menunjukkan blast radius struktural yang besar karena schema dan route memakai utilitas bersama. Angka transitive tersebut adalah overestimate. Blast bisnis yang relevan dibatasi pada kelompok berikut:

- Prisma model dan migrasi Program Budaya.
- Schema create/update Program Budaya.
- Modal dan mutation Program Budaya.
- Route create/update Program Budaya.
- Route submit laporan dan helper form submit PIC.
- Resolver periode analytics.
- Summary, distribusi, ranking, ranking CC, dan top units.
- API dan view halaman utama PIC.
- Compliance report/export yang menawarkan filter periode.
- Query invalidation dan tests terkait.

Kolase, kalender, banner, dan card hanya perlu diverifikasi kontraknya. Mereka tidak perlu dirombak karena sudah membaca `startDate` dan `endDate` dari program.

## 19. Kriteria Selesai

Fitur dianggap selesai jika:

1. Admin dapat memilih TW dan tiga tanggal secara manual.
2. Data lama berhasil mendapatkan deadline tanpa perubahan perilaku.
3. PIC hanya dapat upload pada jendela upload yang valid.
4. Tanggal kegiatan selalu dibatasi oleh periode kegiatan.
5. TW 4 dan TW 1 dapat terbuka bersamaan tanpa pencampuran statistik.
6. Selector halaman utama hanya menampilkan periode upload yang masih tersedia.
7. Statistik periode menghitung seluruh program dalam TW/tahun terpilih.
8. Analytics tidak lagi menggunakan bulan kalender tetap sebagai identitas TW Program Budaya.
9. Edit periode tidak dapat membuat laporan lama menjadi inkonsisten.
10. Tidak ada regresi scope unit, authorization, pagination, atau performa query.

## 20. Urutan Implementasi yang Disarankan

1. Migrasi dan backfill `uploadDeadline`.
2. Schema dan helper validasi periode.
3. API create/update Program Budaya.
4. Modal Program Budaya.
5. Validasi submit backend dan frontend.
6. Resolver periode analytics.
7. Consumer analytics dan compliance.
8. Selector periode serta statistik halaman utama PIC.
9. Test, query review, dan regression check pada kolase, kalender, serta banner.

Urutan ini menjaga kompatibilitas data terlebih dahulu dan memungkinkan setiap lapisan diverifikasi sebelum consumer berikutnya dipindahkan.
