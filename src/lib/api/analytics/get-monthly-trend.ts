import { prisma } from "@/lib/prisma";
import { Prisma } from "@generated/prisma";

const NAMA_BULAN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export async function getMonthlyTrend(
  currentWhere: Prisma.ActivityReportWhereInput,
  previousWhere: Prisma.ActivityReportWhereInput,
  year: number,
) {
  const prevYear = year - 1;

  const countsPromises = Array.from({ length: 12 }, (_, month) => [
    prisma.activityReport.count({
      where: {
        ...currentWhere,
        tanggalKegiatan: {
          gte: new Date(year, month, 1),
          lte: new Date(year, month + 1, 0, 23, 59, 59),
        },
      },
    }),
    prisma.activityReport.count({
      where: {
        ...previousWhere,
        tanggalKegiatan: {
          gte: new Date(prevYear, month, 1),
          lte: new Date(prevYear, month + 1, 0, 23, 59, 59),
        },
      },
    }),
  ]).flat();

  const results = await Promise.all(countsPromises);

  const kegiatanPerBulan = NAMA_BULAN.map((bulan, i) => ({
    periode: bulan,
    tahunIni: results[i * 2],
    tahunLalu: results[i * 2 + 1],
  }));

  const kegiatanPerTriwulan = [
    "Triwulan 1",
    "Triwulan 2",
    "Triwulan 3",
    "Triwulan 4",
  ].map((tw, i) => {
    const start = i * 3;
    return {
      periode: tw,
      tahunIni: kegiatanPerBulan
        .slice(start, start + 3)
        .reduce((s, m) => s + m.tahunIni, 0),
      tahunLalu: kegiatanPerBulan
        .slice(start, start + 3)
        .reduce((s, m) => s + m.tahunLalu, 0),
    };
  });

  const kegiatanPerSemester = ["Semester 1", "Semester 2"].map((sem, i) => {
    const start = i * 6;
    return {
      periode: sem,
      tahunIni: kegiatanPerBulan
        .slice(start, start + 6)
        .reduce((s, m) => s + m.tahunIni, 0),
      tahunLalu: kegiatanPerBulan
        .slice(start, start + 6)
        .reduce((s, m) => s + m.tahunLalu, 0),
    };
  });

  return { kegiatanPerBulan, kegiatanPerTriwulan, kegiatanPerSemester };
}
