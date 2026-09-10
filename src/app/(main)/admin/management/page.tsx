import { Metadata } from "next";
import ManagementUserView from "./_components/ManagementUserView";

export const metadata: Metadata = {
  title: "Manajemen PIC",
  description: "Kelola penugasan dan status PIC berdasarkan unit kerja",
};

type ManagementSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ManagementPage({
  searchParams,
}: {
  searchParams: ManagementSearchParams;
}) {
  const params = await searchParams;
  const readParam = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return (
    <div className="h-full">
      <ManagementUserView
        deepLinkParams={{
          unitId: readParam(params.unitId),
          nip: readParam(params.nip),
          unitType: readParam(params.unitType),
        }}
      />
    </div>
  );
}
