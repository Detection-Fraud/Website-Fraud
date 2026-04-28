export default async function DetailKegiatanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <h1>Detail Kegiatan</h1>
    </div>
  );
}
