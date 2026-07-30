import { Metadata } from "next";
import DetailView from "./_components/DetailView";
import { prisma } from "@/lib/prisma";

interface PropTypes {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PropTypes): Promise<Metadata> {
  const { id } = await params;
  try {
    const report = await prisma.activityReport.findUnique({
      where: { id },
      select: { activityName: true, description: true },
    });

    if (!report) {
      return {
        title: "Laporan Tidak Ditemukan",
      };
    }
    const title = `${report.activityName} - Detail Laporan`;
    return { title };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Detail Laporan",
    };
  }
}
export default async function DetailDetection({ params }: PropTypes) {
  const { id } = await params;

  return (
    <div>
      <DetailView id={id} />
    </div>
  );
}
