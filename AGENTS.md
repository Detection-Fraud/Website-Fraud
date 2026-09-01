# AGENTS.md

Panduan ini berlaku untuk seluruh repository. Gunakan instruksi yang lebih
spesifik jika suatu subdirectory memiliki `AGENTS.md` sendiri.

## Project Overview

Fraud App adalah sistem pelaporan kegiatan budaya karyawan BULOG. Aplikasi
mencakup autentikasi berbasis role, pelaporan kegiatan, approval workflow,
fraud detection, analytics, repository laporan, dan pengelolaan master data.

Saat dokumentasi bertentangan, prioritaskan urutan berikut:

1. Permintaan pengguna dan acceptance criteria.
2. Implementasi aktif, `package.json`, dan `prisma/schema.prisma`.
3. File ini dan skill yang relevan.
4. `README.md` dan dokumentasi roadmap lama.

`README.md` saat ini masih berupa template Create Next App. Jangan gunakan
README sebagai sumber arsitektur atau perilaku aplikasi tanpa verifikasi.

## Tech Stack

- Next.js 16 App Router dan React 19.
- TypeScript strict mode dengan alias `@/*` ke `src/*`.
- Prisma 6 dengan PostgreSQL; client dihasilkan ke `generated/prisma`.
- Auth.js/NextAuth v5 dengan JWT session dan role `ADMIN`, `PIC`, `VIEWER`.
- Axios dan TanStack Query untuk komunikasi API internal dari client.
- Zod 4 untuk validasi input.
- HeroUI v3 dan Tailwind CSS v4 untuk UI.
- Zustand untuk state client yang benar-benar global.
- Recharts untuk visualisasi data.

Jangan mengubah versi mayor, menambah dependency, atau mengganti library utama
tanpa kebutuhan yang jelas dan persetujuan pengguna.

## Commands

Gunakan npm karena repository memiliki `package-lock.json`.

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
npm run prisma:seed
```

Belum ada script `test` di `package.json`. Jalankan test yang relevan secara
targeted sesuai runner yang digunakan file tersebut; jangan mengklaim seluruh
test suite lulus jika tidak ada perintah suite yang dijalankan.

## Important Paths

- `src/app/`: layouts, pages, dan Route Handlers App Router.
- `src/app/(auth)/`: halaman login dan pengaturan autentikasi.
- `src/app/(main)/`: shell aplikasi yang membutuhkan autentikasi.
- `src/app/api/`: endpoint API internal.
- `src/components/`: komponen shared dan feature UI.
- `src/hooks/`: query dan mutation hooks.
- `src/lib/api.ts`: shared Axios instance untuk API internal.
- `src/lib/api/`: auth guard, unit scope, rate limit, dan service API.
- `src/schemas/`: schema Zod untuk request dan query parameter.
- `src/types/`: domain dan session types.
- `src/store/`: Zustand stores.
- `prisma/schema.prisma`: sumber utama model dan enum database.
- `prisma/migrations/`: riwayat perubahan schema database.
- `generated/prisma/`: generated code; jangan diedit manual.

## Working Method

- Baca implementasi, caller, dan test terkait sebelum mengubah perilaku.
- Selesaikan root cause dengan perubahan terkecil yang benar.
- Reuse helper, schema, hook, type, dan komponen yang sudah ada.
- Jangan membuat abstraction untuk satu penggunaan atau scaffolding spekulatif.
- Jangan mengubah file unrelated atau membatalkan perubahan yang bukan milikmu.
- Pertahankan pola, naming, dan bahasa UI yang sudah digunakan area terkait.
- Jangan menyimpan secret, token, credential, atau nilai `.env` di source code.
- Jika requirement bertentangan dengan source atau aturan keamanan, jelaskan
  konflik tersebut sebelum mengambil asumsi yang berisiko.

## Next.js Rules

- Gunakan `src/proxy.ts`; jangan membuat `middleware.ts` baru.
- Di Route Handler dinamis, `params` adalah Promise dan wajib di-`await`.
- Gunakan `auth()` dari `@/auth`; jangan gunakan `getServerSession` atau
  `authOptions` dari pola NextAuth lama.
- Pertahankan Server Component sebagai default. Tambahkan `"use client"` hanya
  ketika komponen membutuhkan browser API, event handler, atau client hook.
- Jangan memindahkan logic server, Prisma query, atau secret ke Client Component.
- Gunakan dokumentasi dari versi Next.js yang terpasang ketika perilaku framework
  tidak jelas.

## API, Auth, and Validation

- Semua endpoint harus memvalidasi autentikasi dan authorization di server.
- Gunakan `requireAuth()`, `requireAdmin()`, atau `requirePic()` dari
  `src/lib/api/auth-guard.ts` sesuai kebutuhan endpoint.
- Bungkus error Route Handler dengan `handleApiError()`.
- Gunakan `successResponse()` dan `errorResponse()` dari `src/lib/response.ts`
  agar response envelope konsisten.
- Validasi body, query parameter, enum, tanggal, dan identifier dengan Zod.
- Jangan mengandalkan hidden tab, disabled button, atau filter frontend sebagai
  satu-satunya security guard.
- Role, `unitId`, ownership, status program, periode, dan permission harus selalu
  diverifikasi dari session dan database.
- Jangan mengirim raw exception, stack trace, atau detail internal ke client.
- Pertahankan rate limit, path traversal protection, MIME validation, magic-byte
  validation, dan size limit pada endpoint sensitif atau upload.
- Gunakan transaction untuk write yang saling terkait atau check-then-write yang
  rentan race condition.

## Scope and Domain Rules

- `ADMIN` dapat mengakses data global sesuai kemampuan endpoint.
- Scope `PIC` ditentukan oleh `unitId` dan tipe unit, bukan role tambahan.
- PIC Kantor Wilayah dapat mencakup unit sendiri dan Kantor Cabang child sesuai
  aturan endpoint; PIC Kantor Cabang atau Divisi hanya mengakses scope sendiri.
- Reuse helper di `src/lib/api/unit-scope.ts`; jangan membuat variasi scope baru
  langsung di setiap endpoint.
- Lifecycle laporan adalah `PENDING` menuju `APPROVED` atau `REJECTED`.
- Validasi kritis program dan laporan tetap dilakukan di backend, termasuk
  program aktif, periode kegiatan, upload deadline, target unit, dan ownership.
- Notifikasi approval/rejection harus ditargetkan kepada pembuat laporan, bukan
  disiarkan ke seluruh PIC pada wilayah yang sama.

## Client Data Fetching

- Gunakan shared Axios instance `api` dari `@/lib/api` untuk API internal.
- Gunakan TanStack Query untuk GET dan mutation dari Client Component.
- Jangan menambah pola baru `useEffect` + `fetch` + `useState` untuk server data.
- Masukkan semua filter yang memengaruhi hasil ke dalam query key.
- Gunakan `enabled` untuk query yang bergantung pada nilai wajib.
- Setelah mutation sukses, invalidate atau update query cache yang relevan.
- Manfaatkan response interceptor yang sudah meng-unwrapped response envelope;
  jangan melakukan parsing envelope kedua kali tanpa memeriksa kontraknya.
- Jangan membuat Axios instance atau QueryClient baru untuk setiap feature.
- Zustand bukan pengganti TanStack Query untuk server state.

## Prisma and Database

- Dilarang memakai `findMany().length` untuk menghitung data.
- Gunakan `count()`, `groupBy()`, aggregate query, atau SQL aggregation.
- Gunakan pagination (`skip`/`take` atau cursor) untuk list yang dapat membesar.
- Pilih hanya field dan relation yang diperlukan; hindari payload tanpa batas.
- Jalankan query independen secara paralel ketika aman.
- Gunakan transaction untuk beberapa write yang harus atomic.
- Pertahankan filtering role dan unit pada database query, bukan setelah seluruh
  data dimuat ke memory.
- Jangan mengedit `generated/prisma/` manual.
- Perubahan model harus dilakukan di `prisma/schema.prisma` dan disertai strategi
  migration yang sesuai; jangan menghapus atau reset data tanpa izin eksplisit.

## UI and Accessibility

- Gunakan API HeroUI v3, bukan contoh atau prop HeroUI v2.
- HeroUI v3 memakai compound component dan Tailwind CSS v4; tidak membutuhkan
  provider global HeroUI.
- Reuse komponen di `src/components/ui/` dan layout yang sudah ada.
- Gunakan design token dan corporate palette di `src/app/globals.css`.
- Pertahankan responsive behavior untuk desktop dan mobile.
- Gunakan semantic HTML, accessible label, keyboard interaction, focus state,
  loading state, empty state, dan error state yang jelas.
- Gunakan event API komponen yang sesuai, misalnya `onPress` pada komponen
  React Aria/HeroUI ketika didukung.
- Jangan mencampur BEM classes dari `@heroui/styles` dengan React component API
  kecuali area tersebut memang menggunakan pendekatan CSS-only.

## Tests and Verification

- Verifikasi perubahan dengan pemeriksaan terkecil yang benar, lalu perluas
  sesuai blast radius.
- Untuk perubahan TypeScript, jalankan `npm run lint` dan `npx tsc --noEmit`.
- Jalankan targeted test untuk helper, schema, guard, atau business logic yang
  diubah jika test tersedia.
- Tambahkan test kecil untuk logic non-trivial, authorization, scope, validasi,
  atau bug yang berpotensi regresi.
- Jalankan `npm run build` untuk perubahan route, rendering, auth, config,
  dependency, atau integrasi lint/type yang luas.
- Jangan memperbaiki warning atau failure unrelated kecuali diminta; laporkan
  secara jelas jika failure tersebut menghalangi verifikasi.

## Relevant Skills

Gunakan skill yang paling relevan dan verifikasi petunjuknya terhadap source
code aktif karena beberapa roadmap atau contoh lama dapat stale.

- API route dan authorization: `api-backend-guard`.
- GET dan mutation client: `axios-tanstack-query`.
- Prisma query, analytics, dan pagination: `prisma-safe-query`.
- Zod schema: `zod`.
- Dashboard dan chart: `dashboard-analytics`.
- Repository laporan dan export: `repository-dan-export`.
- HeroUI components: `heroui-react`.
- UI redesign atau design system: gunakan skill frontend yang sesuai sambil
  mempertahankan visual language aplikasi.

Jangan menaruh status epic, persentase progress, path lokal mesin, model agent,
atau konfigurasi global OpenCode di file ini. Hal-hal tersebut berubah terpisah
dari aturan engineering repository.
