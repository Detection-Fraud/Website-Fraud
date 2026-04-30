import DetailView from "./_components/DetailView";

interface PropTypes {
  params: Promise<{ id: string }>;
}
export default async function DetailDetection({ params }: PropTypes) {
  const { id } = await params;

  return (
    <div>
      <DetailView id={id} />
    </div>
  );
}
